import {DeliverTxResponse, EncodeObject, StdFee} from "@bze/bzejs/types";
import {TxBody, SignerInfo} from "@bze/bzejs/cosmos/tx/v1beta1/tx";
import {useChain} from "@interchain-kit/react";
import {getChainExplorerURL, getChainName, getGasMultiplier} from "../constants/chain";
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
import {calculatePoolOppositeAmount} from "../utils/liquidity_pool";
import {toBigNumber} from "../utils/amount";
import {coins} from "../utils/coins";

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
    const {address, disconnect} = useChain(chainName);
    const {toast} = useToast();
    const {signingClient, isSigningClientReady, signingClientError} = useSigningClient({chainName: chainName});
    const [progressTrack, setProgressTrack] = useState("")
    const {getDenomsPool} = useLiquidityPools()
    const {feeDenom} = useSettings()

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
        const gasPrice = 0.02;
        const nativeDenom = getChainNativeAssetDenom();
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
        expectedAmount = expectedAmount.multipliedBy(1.5).integerValue(BigNumber.ROUND_FLOOR)
        //if the fee resulted from swapping the fee amount is lower than 1, it can't be paid.
        //we have to make sure the blockchain can capture the swap fee.
        if (expectedAmount.multipliedBy(pool.fee).lt(1)) {
            expectedAmount = toBigNumber(1).dividedBy(pool.fee).integerValue(BigNumber.ROUND_CEIL)
        }

        return {
            amount: coins(expectedAmount.toFixed(0).toString(), feeDenom),
            gas: gasAmount.multipliedBy(1.5).toFixed(0)
        };
    }, [signingClient, address, feeDenom, getDenomsPool]);

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

    const tx = useCallback(async (msgs: EncodeObject[], options?: TxOptions|undefined) => {
        if (!address) {
            toast.error(TxStatus.Failed, 'Please connect the wallet')
            return;
        }

        if (!(await canUseClient())) {
            toast.error(TxStatus.Failed, 'Can not find suitable signing client. Make sure your wallet is installed, connected and unlocked.')
            disconnect()
            return;
        }

        setProgressTrack("Getting fee")
        const broadcastToastId = toast.loading(TxStatus.Broadcasting,'Waiting for transaction to be signed and included in block')
        if (signingClient) {
            try {
                const fee = await getFee(msgs, options);
                setProgressTrack("Signing transaction")
                const broadcastResult = await (signingClient as any).signAndBroadcast(address, msgs, fee, options?.memo ?? getDefaultTxMemo())
                setProgressTrack("Waiting for confirmation")
                const resp = await broadcastResult.wait();
                const txHash = resp?.txhash || broadcastResult.transactionHash;
                if (resp?.code === 0) {
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
                //@ts-expect-error - small chances for e to be undefined
                if (e.message.includes("Failed to retrieve account from signer")) {
                    disconnect()
                }
                // @ts-expect-error - small chances for e to be undefined
                toast.error(TxStatus.Failed, prettyError(e?.message));
                if (options?.onFailure) {
                    // @ts-expect-error - small chances for e to be undefined
                    options.onFailure(prettyError(e?.message) || "Unknown error")
                }
            }
        }
        toast.dismiss(broadcastToastId);
        setTimeout(() => {
            setProgressTrack("")
        }, options?.progressTrackerTimeout || 5000)
    }, [address, canUseClient, toast, signingClient, disconnect, getFee, chainName, defaultChainName]);

    return {
        tx,
        progressTrack
    };
};
