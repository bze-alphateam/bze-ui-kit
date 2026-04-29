import {EncodeObject, StdFee} from "@bze/bzejs/types";
import {TxBody, SignerInfo} from "@bze/bzejs/cosmos/tx/v1beta1/tx";
import {useChain} from "@interchain-kit/react";
import {CosmosWallet} from "@interchain-kit/core";
import {DirectSigner} from "@interchainjs/cosmos/signers/direct-signer";
import {createCosmosQueryClient} from "@interchainjs/cosmos";
import {getChainExplorerURL, getChainName, getForeignFeeSlippage, getGasMultiplier, getGasPrice, getNonNativeGasMultiplier} from "../constants/chain";
import {getTxFeeCollectorParams} from "../query/txfeecollector_params";
import {useToast} from "./useToast";
import {prettyError} from "../utils/user_errors";
import {getChainNativeAssetDenom} from "../constants/assets";
import {useSigningClient} from "./useSigningClient";
import {openExternalLink, sleep} from "../utils/functions";
import BigNumber from "bignumber.js";
import {getDefaultTxMemo} from "../constants/placeholders";
import {useCallback, useMemo, useState} from "react";
import {useLiquidityPools} from "./useLiquidityPools";
import {useSettings} from "./useSettings";
import {useFeeTokens} from "./useFeeTokens";
import {calculatePoolOppositeAmount} from "../utils/liquidity_pool";
import {coins} from "../utils/coins";
import {registerBzeEncoders} from "../utils/signing_client_setup";

// The actual payload delivered to onSuccess — the result of broadcastResult.wait(),
// which is a TxResponse from @interchainjs/cosmos containing the inclusion details.
export interface TxSuccessResponse {
    height: number;
    txhash: string;
    code: number;
    rawLog?: string;
    [key: string]: unknown;
}

export interface TxOptions {
    fee?: StdFee | null;
    onSuccess?: (res: TxSuccessResponse) => void;
    onFailure?: (err: string) => void;
    memo?: string;
    progressTrackerTimeout?: number;
    /**
     * Force direct (protobuf) sign mode for this transaction instead of the
     * app-wide preferred sign type. Needed for IBC MsgTransfer: bzejs v3's
     * amino converter emits fields BZE's chain doesn't know about, and the
     * signature verification fails with code 4. Direct sign bypasses amino
     * entirely.
     */
    useDirectSign?: boolean;
    /**
     * Let the wallet extension (Keplr/Leap) compute and set the fee. Only
     * meaningful when {@link useDirectSign} is true. Used for deposits from
     * foreign chains, where we don't know the correct gas price and letting
     * the wallet pick it is the safest option. The fee passed to
     * signAndBroadcast is replaced with an empty zero-gas placeholder and
     * the underlying offline signer is configured with
     * `preferNoSetFee: false` so Keplr overrides it.
     */
    letWalletSetFee?: boolean;
}

export enum TxStatus {
    Failed = 'Transaction Failed',
    Successful = 'Transaction Successful',
    Broadcasting = 'Transaction Pending',
}

const defaultFee = {
    amount: coins(20000, getChainNativeAssetDenom()),
    gas: "500000"
}

export const useSDKTx = (chainName?: string) => {
    const {tx, progressTrack} = useTx(chainName ?? getChainName());

    return {
        tx,
        progressTrack
    }
}

export const useBZETx = () => {
    const {tx, progressTrack} = useTx(getChainName());

    return {
        tx,
        progressTrack,
    }
}

export const useIBCTx = (chainName?: string) => {
    const {tx, progressTrack} = useTx(chainName ?? getChainName());

    return {
        tx,
        progressTrack
    }
}

const useTx = (chainName: string) => {
    const {address, disconnect, wallet, chain, getRpcEndpoint} = useChain(chainName);
    const {toast} = useToast();
    const {signingClient, isSigningClientReady, signingClientError} = useSigningClient({chainName: chainName});

    /**
     * Build a one-off direct-mode signing client, bypassing the app-wide
     * amino preference. Used only when {@link TxOptions.useDirectSign} is set.
     *
     * When `letWalletSetFee` is true, the offline signer is wrapped so
     * `signDirect` calls the underlying wallet with `{ preferNoSetFee: false }`
     * — this tells Keplr/Leap to replace the fee we submit with its own
     * recommended fee, which is what we want for foreign-chain deposits where
     * we don't have gas price knowledge.
     */
    const buildDirectSigningClient = useCallback(async (letWalletSetFee: boolean = false) => {
        if (!wallet || !chain) throw new Error("Wallet or chain unavailable");
        // `wallet` from useChain is a ChainWalletStore — use its helper to walk
        // down to the concrete CosmosWallet instance (Keplr, Leap, WC, etc).
        const cosmosWallet =
            typeof (wallet as any).getWalletOfType === "function"
                ? (wallet as any).getWalletOfType(CosmosWallet)
                : (wallet as any);
        if (!cosmosWallet) throw new Error("Cosmos wallet not found");
        const rpcEndpoint = await getRpcEndpoint();
        const rpcUrl = typeof rpcEndpoint === "string" ? rpcEndpoint : (rpcEndpoint as any).url;
        const chainId = (chain as any).chainId;
        const rawOfflineSigner: any = await cosmosWallet.getOfflineSigner(chainId, "direct");

        const offlineSigner = letWalletSetFee
            ? {
                getAccounts: rawOfflineSigner.getAccounts.bind(rawOfflineSigner),
                signDirect: async (signer: string, signDoc: any) => {
                    // Bypass the app-wide patched signOptions and force the wallet
                    // to compute its own fee for this transaction.
                    return cosmosWallet.signDirect(chainId, signer, signDoc, { preferNoSetFee: false });
                },
            }
            : rawOfflineSigner;

        const queryClient = await createCosmosQueryClient(rpcUrl);
        const directClient: any = new (DirectSigner as any)(offlineSigner, {
            queryClient,
            addressPrefix: (chain as any).bech32Prefix,
            chainId,
        });
        registerBzeEncoders(directClient);
        return directClient;
    }, [wallet, chain, getRpcEndpoint]);
    const [progressTrack, setProgressTrack] = useState("")
    const {getDenomsPool} = useLiquidityPools()
    const {feeDenom} = useSettings()
    const {isValidFeeDenom} = useFeeTokens()

    const defaultChainName = useMemo(() => getChainName(), []);

    const canUseClient = useCallback(async () => {
        if (!isSigningClientReady) {
            //TODO: this is a hack to make sure the signing client is ready. Remove this when we have a better way to
            // do this
            console.error("waiting for signing client to be ready", signingClientError)

            await sleep(1_000)
        }

        return isSigningClientReady
    }, [isSigningClientReady, signingClientError]);

    const simulateFee = useCallback(async (messages: EncodeObject[], memo: string | undefined): Promise<StdFee> => {
        const nativeDenom = getChainNativeAssetDenom();

        // Prefer the chain's validator_min_gas_fee param over the env default, so
        // governance changes propagate without a frontend redeploy. Fall back to env
        // if the query fails or returns an unexpected denom.
        let gasPrice = getGasPrice();
        const txFeeParams = await getTxFeeCollectorParams();
        if (txFeeParams?.validatorMinGasFee?.denom === nativeDenom) {
            const chainGasPrice = parseFloat(txFeeParams.validatorMinGasFee.amount);
            if (!isNaN(chainGasPrice) && chainGasPrice > 0) {
                gasPrice = chainGasPrice;
            }
        }

        const signer = signingClient as any;

        // Encode messages into TxBody using the signer's own encoders
        const encodedMessages = messages.map(({typeUrl, value}) => {
            const encoder = signer.getEncoder(typeUrl);
            const encodedWriter = encoder.encode(value);
            const encodedValue = typeof encodedWriter?.finish === 'function' ? encodedWriter.finish() : encodedWriter;
            return {typeUrl, value: encodedValue};
        });
        const txBody = TxBody.fromPartial({messages: encodedMessages, memo: memo ?? ''});
        // BZE ante handler checks sequence even in simulation — use the real sequence
        const sequence = await signer.getSequence(address);
        const signerInfo = SignerInfo.fromPartial({modeInfo: {single: {mode: 1}}, sequence});
        const {gasInfo} = await signer.simulateByTxBody(txBody, [signerInfo]);
        const gasEstimated = Number(gasInfo?.gasUsed ?? BigInt(0));
        if (gasEstimated === 0) {
            throw new Error("Gas simulation returned 0");
        }

        const gasAmount = BigNumber(gasEstimated).multipliedBy(getGasMultiplier());
        const gasPayment = gasAmount.multipliedBy(gasPrice);
        const nativeFee = {
            amount: coins(gasPayment.toFixed(0).toString(), nativeDenom),
            gas: gasAmount.toFixed(0)
        }

        //user wants to pay in the fee in native denomination
        if (feeDenom === nativeDenom) {
            return nativeFee;
        }

        //validate that the selected fee denom still has enough liquidity
        if (!isValidFeeDenom(feeDenom)) {
            return nativeFee;
        }

        //search for the pool for the fee denom and calculate the expected amount
        const pool = getDenomsPool(feeDenom, nativeDenom)
        if (!pool) {
            return nativeFee;
        }

        //calculate how much amount we need to pay for fee in the opposite denomination
        let expectedAmount = calculatePoolOppositeAmount(pool, gasPayment, pool.base === nativeDenom)
        if (!expectedAmount.isPositive()) {
            return nativeFee;
        }
        // Apply slippage buffer (default 10%) to absorb pool drift between simulation and inclusion.
        // ROUND_CEIL guarantees at least 1 unit of the foreign denom; if the swap fee rounds to 0
        // on-chain, the txfeecollector module accumulates the dust until it can be swapped.
        expectedAmount = expectedAmount.multipliedBy(getForeignFeeSlippage()).integerValue(BigNumber.ROUND_CEIL)

        return {
            amount: coins(expectedAmount.toFixed(0).toString(), feeDenom),
            gas: gasAmount.multipliedBy(getNonNativeGasMultiplier()).toFixed(0)
        };
    }, [signingClient, address, feeDenom, getDenomsPool, isValidFeeDenom]);

    const getFee = useCallback(async (messages: EncodeObject[], options?: TxOptions|undefined): Promise<StdFee> => {
        try {
            if (options?.fee) {
                return options.fee;
            } else {
                setProgressTrack("Simulating transaction")
                return await simulateFee(messages, options?.memo);
            }
        } catch (e) {
            console.error("could not get fee, using default fee: ", e);
            return defaultFee;
        }
    }, [simulateFee]);

    const tx = useCallback(async (msgs: EncodeObject[], options?: TxOptions|undefined): Promise<boolean> => {
        if (!address) {
            toast.error(TxStatus.Failed, 'Please connect the wallet')
            return false;
        }

        if (!(await canUseClient())) {
            toast.error(TxStatus.Failed, 'Can not find suitable signing client. Make sure your wallet is installed, connected and unlocked.')
            disconnect()
            return false;
        }

        setProgressTrack("Getting fee")
        const broadcastToastId = toast.loading(TxStatus.Broadcasting,'Waiting for transaction to be signed and included in block')
        let success = false;
        if (signingClient) {
            try {
                // For IBC MsgTransfer (and similar) we must bypass amino and sign directly,
                // because bzejs v3's amino converter produces sign-doc bytes that BZE chain
                // rejects with code 4. Build a one-off direct client; fall back to amino
                // client for simulation and non-IBC txs.
                const activeClient: any = options?.useDirectSign
                    ? await buildDirectSigningClient(options?.letWalletSetFee ?? false)
                    : signingClient;

                // When letting the wallet compute the fee, submit an empty fee amount
                // with a reasonable gas ceiling — Keplr sees `preferNoSetFee: false` on
                // the offline signer wrapper and replaces the amount with `gas × its
                // recommended gas price`. If we pass `gas: "0"` the result is 0, which
                // is why we hand it a sane ceiling that covers an IBC MsgTransfer.
                const fee: StdFee = options?.letWalletSetFee
                    ? { amount: [], gas: "300000" }
                    : await getFee(msgs, options);
                setProgressTrack("Signing transaction")
                const broadcastResult = await (activeClient as any).signAndBroadcast(address, msgs, fee, options?.memo ?? getDefaultTxMemo())
                setProgressTrack("Waiting for confirmation")
                const resp = await broadcastResult.wait();
                const txHash = resp?.txhash || broadcastResult.transactionHash;
                if (resp?.code === 0) {
                    success = true;
                    setProgressTrack("Transaction sent")
                    toast.clickableSuccess(TxStatus.Successful, () => {openExternalLink(`${getChainExplorerURL(chainName ?? defaultChainName)}/tx/${txHash}`)}, 'View in Explorer');

                    if (options?.onSuccess) {
                        options.onSuccess(resp as TxSuccessResponse)
                    }
                } else {
                    setProgressTrack("Transaction failed")
                    toast.error(TxStatus.Failed, prettyError(resp?.rawLog));
                    if (options?.onFailure) {
                        options.onFailure(prettyError(resp?.rawLog) || "Unknown error")
                    }
                }
            } catch (e) {
                console.error(e);
                // Disconnect on any signer-related error — the signing client is out of sync
                // with the wallet (e.g. account switched outside the UI between sessions).
                const errMsg = (e as any)?.message ?? "";
                const isSignerError = [
                    "Failed to retrieve account from signer",
                    "Signer address does not match",
                    "signers mismatch",
                    "Signer mismatched",
                ].some(pattern => errMsg.includes(pattern));
                if (isSignerError) {
                    disconnect();
                }
                toast.error(TxStatus.Failed, prettyError(errMsg));
                if (options?.onFailure) {
                    options.onFailure(prettyError(errMsg) || "Unknown error")
                }
            }
        }
        toast.dismiss(broadcastToastId);
        setTimeout(() => {
            setProgressTrack("")
        }, options?.progressTrackerTimeout || 5000)
        return success;
    }, [address, canUseClient, toast, signingClient, disconnect, getFee, chainName, defaultChainName, buildDirectSigningClient]);

    return {
        tx,
        progressTrack
    };
};
