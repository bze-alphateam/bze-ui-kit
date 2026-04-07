'use client'

/**
 * Skip-routed transfer orchestrator. Handles both Cosmos and EVM signing
 * paths, including multi-tx routes (ERC20 approve + bridge).
 *
 * Reusable from any context — the Buy BZE form is the primary consumer,
 * but future features (USDC deposit via Skip, etc.) can call the same hook.
 */

import {useCallback, useState} from "react";
import {useSDKTx} from "./useTx";
import {useEvmTransaction} from "./useEvmTransaction";
import {useToast} from "./useToast";
import {skipGetMsgs} from "../query/skip";
import {convertSkipMsgToEncodeObject} from "../utils/cross_chain";
import {getChainName} from "../constants/chain";
import type {SkipRouteResponse} from "../types/cross_chain";

interface UseSkipBridgeTransferReturn {
    executeSkipTransfer: (
        route: SkipRouteResponse,
        getAddress: (chainId: string) => string | undefined | Promise<string | undefined>,
    ) => Promise<{ success: boolean; txHash?: string; chainId?: string; error?: string }>;
    isExecuting: boolean;
    progressMessage: string;
}

export function useSkipBridgeTransfer(signingChainName?: string): UseSkipBridgeTransferReturn {
    const {tx} = useSDKTx(signingChainName || getChainName());
    const evmTxHook = useEvmTransaction();
    const {toast} = useToast();
    const [isExecuting, setIsExecuting] = useState(false);
    const [progressMessage, setProgressMessage] = useState('');

    const executeSkipTransfer = useCallback(async (
        route: SkipRouteResponse,
        getAddress: (chainId: string) => string | undefined | Promise<string | undefined>,
    ): Promise<{ success: boolean; txHash?: string; chainId?: string; error?: string }> => {
        setIsExecuting(true);
        setProgressMessage('Collecting addresses...');

        try {
            // ── Build address list ─────────────────────────────────────────
            const addressList: string[] = [];
            for (const chainId of route.required_chain_addresses) {
                const addr = await getAddress(chainId);
                if (!addr) {
                    toast.error("Transfer failed", `Missing wallet address for chain ${chainId}`);
                    return {success: false, error: `Missing address for chain ${chainId}`};
                }
                addressList.push(addr);
            }

            // ── Build messages ─────────────────────────────────────────────
            setProgressMessage('Building transfer...');
            const msgsResponse = await skipGetMsgs({
                source_asset_denom: route.source_asset_denom,
                source_asset_chain_id: route.source_asset_chain_id,
                dest_asset_denom: route.dest_asset_denom,
                dest_asset_chain_id: route.dest_asset_chain_id,
                amount_in: route.amount_in,
                amount_out: route.amount_out,
                address_list: addressList,
                operations: route.operations,
                slippage_tolerance_percent: "3",
                timeout_seconds: "600",
            });

            if (!msgsResponse?.txs?.length) {
                toast.error("Transfer failed", "Could not build transfer messages.");
                return {success: false, error: "Failed to build transfer messages."};
            }

            const totalTxs = msgsResponse.txs.length;
            let lastTxHash: string | undefined;
            let lastChainId: string | undefined;

            // ── Execute each tx sequentially ───────────────────────────────
            for (let txIdx = 0; txIdx < totalTxs; txIdx++) {
                const skipTx = msgsResponse.txs[txIdx];
                const stepLabel = totalTxs > 1 ? `Step ${txIdx + 1}/${totalTxs}: ` : '';

                // Check if this is an EVM transaction — Skip puts EVM data on
                // `tx.evm_tx` (not inside `msgs[]`), and `tx.chain_id` may be
                // absent for EVM txs (the chain_id lives on evm_tx instead).
                const txMsgs = skipTx.msgs ?? (skipTx as any).cosmos_tx?.msgs;
                const firstMsg = txMsgs?.[0];
                const evmTx = firstMsg?.evm_tx ?? (skipTx as any).evm_tx;
                const isEvm = !!evmTx;

                // Resolve chain_id: tx-level for Cosmos, evm_tx-level for EVM
                lastChainId = skipTx.chain_id || evmTx?.chain_id?.toString();

                if (isEvm && evmTx) {
                    // ── EVM path: approve + bridge handled by useEvmTransaction ──
                    setProgressMessage(`${stepLabel}Processing EVM transaction...`);
                    const evmResult = await evmTxHook.executeEvmTx(evmTx);
                    if (!evmResult.success) {
                        toast.error("Transfer failed", evmResult.error || "EVM transaction failed");
                        return {success: false, error: evmResult.error, chainId: skipTx.chain_id};
                    }
                    lastTxHash = evmResult.txHash;
                } else {
                    // ── Cosmos path: existing signAndBroadcast flow ───────────
                    if (!txMsgs?.length) {
                        toast.error("Transfer failed", "No messages in transaction.");
                        return {success: false, error: "No messages in transaction."};
                    }

                    const encodeObjects = txMsgs.map((msg: any) => convertSkipMsgToEncodeObject(msg));
                    const isForeignChain = skipTx.chain_id !== 'beezee-1';

                    setProgressMessage(`${stepLabel}Waiting for signature...`);
                    const success = await tx(encodeObjects, {
                        useDirectSign: isForeignChain,
                        letWalletSetFee: isForeignChain,
                    });

                    if (!success) {
                        return {success: false, error: "Cosmos transaction failed", chainId: skipTx.chain_id};
                    }
                }
            }

            return {
                success: true,
                txHash: lastTxHash,
                chainId: lastChainId,
            };
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : 'Transfer failed';
            console.error('[useSkipBridgeTransfer] error:', e);
            return {success: false, error: errorMsg};
        } finally {
            setIsExecuting(false);
            setProgressMessage('');
        }
    }, [tx, evmTxHook, toast]);

    return {executeSkipTransfer, isExecuting, progressMessage};
}
