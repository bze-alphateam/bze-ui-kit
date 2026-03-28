import {DeliverTxResponse, EncodeObject, StdFee} from "@bze/bzejs/types";
import {useChain} from "@interchain-kit/react";
import {getChainExplorerURL, getChainName} from "../constants/chain";
import {useToast} from "./useToast";
import {prettyError} from "../utils/user_errors";
import {getChainNativeAssetDenom} from "../constants/assets";
import {useSigningClient} from "./useSigningClient";
import {openExternalLink, sleep} from "../utils/functions";
import BigNumber from "bignumber.js";
import {DEFAULT_TX_MEMO} from "../constants/placeholders";
import {useCallback, useMemo, useState} from "react";
import {useLiquidityPools} from "./useLiquidityPools";
import {useSettings} from "./useSettings";
import {calculatePoolOppositeAmount} from "../utils/liquidity_pool";
import {toBigNumber} from "../utils/amount";

const coins = (amount: number | string, denom: string) => [{amount: String(amount), denom}];

export interface TxOptions {
    fee?: StdFee | null;
    onSuccess?: (res: DeliverTxResponse) => void;
    onFailure?: (err: string) => void;
    memo?: string;
    progressTrackerTimeout?: number;
    fallbackOnSimulate?: boolean;
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
        const gasEstimated = await (signingClient as any).simulate(address, messages, memo);

        const gasAmount = BigNumber(gasEstimated).multipliedBy(1.5);
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
            console.error("could not get fee: ", e);

            if (options?.fallbackOnSimulate) {
                return defaultFee;
            } else {
                throw e;
            }
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
                const resp = await (signingClient as any).signAndBroadcast(address, msgs, fee, options?.memo ?? DEFAULT_TX_MEMO)
                if (resp.code === 0) {
                    setProgressTrack("Transaction sent")
                    toast.clickableSuccess(TxStatus.Successful, () => {openExternalLink(`${getChainExplorerURL(chainName ?? defaultChainName)}/tx/${resp.transactionHash}`)}, 'View in Explorer');

                    if (options?.onSuccess) {
                        options.onSuccess(resp)
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
