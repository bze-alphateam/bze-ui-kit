'use client'

import {useCallback, useMemo} from "react";
import {useChain} from "@interchain-kit/react";
import type {RoutePreview} from "../types/cross_chain";
import type {BridgeableAsset} from "./useBridgeableAssets";
import type {WithdrawableAsset, WithdrawDestinationChain} from "./useWithdrawableBalances";
import {getChainName} from "../constants/chain";
import {useIbcBridgeTransfer, type IbcTransferPlan} from "./useIbcBridgeTransfer";
import {useToast} from "./useToast";

interface UseBridgeTransferDepositInput {
    direction: 'deposit';
    asset: BridgeableAsset | undefined;
    amount: string;
    routePreview: RoutePreview | undefined;
}

interface UseBridgeTransferWithdrawInput {
    direction: 'withdraw';
    asset: WithdrawableAsset | undefined;
    destination: WithdrawDestinationChain | undefined;
    amount: string;
    routePreview: RoutePreview | undefined;
}

type UseBridgeTransferInput = UseBridgeTransferDepositInput | UseBridgeTransferWithdrawInput;

interface UseBridgeTransferReturn {
    executeTransfer: () => Promise<boolean>;
    isExecuting: boolean;
    progressMessage: string;
}

/**
 * Orchestrates an IBC deposit or withdraw. Deposit flows work off a
 * `BridgeableAsset` (discovered asset on BZE with a fixed counterparty);
 * withdraw flows work off a `WithdrawableAsset` plus the user's chosen
 * destination chain (which is locked for IBC vouchers and free for BZE/factory
 * tokens). Both collapse into the same `IbcTransferPlan` that
 * `useIbcBridgeTransfer` consumes.
 */
export function useBridgeTransfer(input: UseBridgeTransferInput): UseBridgeTransferReturn {
    const {toast} = useToast();

    // Determine the signing chain: deposits sign on the foreign source chain,
    // withdraws always sign on BZE.
    const signingChainName = useMemo(() => {
        if (input.direction === 'deposit') {
            return input.asset?.counterparty.chainName ?? getChainName();
        }
        return getChainName();
    }, [input]);

    const bzeChain = useChain(getChainName());

    // Counterparty chain depends on direction:
    //   deposit  → the asset's fixed counterparty
    //   withdraw → whichever chain the user selected from the destination picker
    const counterpartyChainName = useMemo(() => {
        if (input.direction === 'deposit') return input.asset?.counterparty.chainName ?? getChainName();
        return input.destination?.chainName ?? getChainName();
    }, [input]);
    const counterpartyChain = useChain(counterpartyChainName);

    const ibcTransfer = useIbcBridgeTransfer(signingChainName);

    const executeTransfer = useCallback(async (): Promise<boolean> => {
        if (!input.amount) {
            toast.error("Transfer failed", "Missing amount.");
            return false;
        }
        if (!input.asset) {
            toast.error("Transfer failed", "Missing asset.");
            return false;
        }
        if (!bzeChain.address || !counterpartyChain.address) {
            const counterpartyDisplay =
                input.direction === 'deposit'
                    ? input.asset.counterparty.displayName
                    : input.destination?.displayName ?? 'the destination chain';
            toast.error(
                "Transfer failed",
                `Please connect your wallet on ${counterpartyDisplay} first.`,
            );
            return false;
        }

        let plan: IbcTransferPlan;

        if (input.direction === 'deposit') {
            // Deposit: sign on the counterparty chain, send the base denom on
            // that chain through the counterparty-side channel, receiver = BZE.
            const {asset} = input;
            plan = {
                isDeposit: true,
                sourceChannel: asset.ibcData.counterparty.channelId,
                tokenDenom: asset.ibcData.counterparty.baseDenom,
                decimals: asset.bzeAsset.decimals,
                sourceAddress: counterpartyChain.address,
                destAddress: bzeChain.address,
                amount: input.amount,
            };
        } else {
            // Withdraw: sign on BZE, send the BZE-side denom through the
            // BZE-side channel for the chosen destination. For IBC vouchers
            // the BZE-side channel is the one the voucher arrived on; for
            // BZE-native / factory tokens it's whichever channel reaches the
            // user's chosen destination. Both values already live on the
            // WithdrawDestinationChain, so the plan-building step is uniform.
            if (!input.destination) {
                toast.error("Transfer failed", "Please choose a destination chain.");
                return false;
            }
            plan = {
                isDeposit: false,
                sourceChannel: input.destination.bzeSideChannelId,
                tokenDenom: input.asset.balance.denom,
                decimals: input.asset.balance.decimals,
                sourceAddress: bzeChain.address,
                destAddress: counterpartyChain.address,
                amount: input.amount,
            };
        }

        return ibcTransfer.executeIbcTransfer(plan);
    }, [input, bzeChain.address, counterpartyChain.address, ibcTransfer, toast]);

    // routePreview is accepted for signature parity with the upcoming Skip
    // phase — today every transfer is pure IBC, so we don't branch on it.
    void input.routePreview;

    return {
        executeTransfer,
        isExecuting: ibcTransfer.isExecuting,
        progressMessage: ibcTransfer.progressMessage,
    };
}
