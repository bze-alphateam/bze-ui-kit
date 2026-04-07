'use client'

import {useCallback, useState} from 'react';
import {
    useAccount,
    useSwitchChain,
    useWriteContract,
    useSendTransaction,
} from 'wagmi';
import {waitForTransactionReceipt} from '@wagmi/core';
import {useConfig} from 'wagmi';
import type {SkipEvmTx} from '../types/cross_chain';
import {ERC20_APPROVE_ABI} from '../utils/evm';

export interface EvmTransactionResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

export interface UseEvmTransactionReturn {
    executeEvmTx: (evmTx: SkipEvmTx) => Promise<EvmTransactionResult>;
    isExecuting: boolean;
    progressMessage: string;
}

/**
 * Core EVM transaction hook. Handles the full approve→bridge sequence for a
 * single `SkipEvmTx`:
 *
 *   1. Switch chain if the wallet is on a different one
 *   2. Process ERC20 approvals sequentially (if any)
 *   3. Send the bridge transaction
 *   4. Wait for receipt
 *
 * Reusable from any context — the buy form's `useSkipBridgeTransfer` calls
 * this for EVM txs, but future features can use it independently.
 */
export function useEvmTransaction(): UseEvmTransactionReturn {
    const [isExecuting, setIsExecuting] = useState(false);
    const [progressMessage, setProgressMessage] = useState('');

    const {chainId: currentChainId} = useAccount();
    const {switchChainAsync} = useSwitchChain();
    const {writeContractAsync} = useWriteContract();
    const {sendTransactionAsync} = useSendTransaction();
    const config = useConfig();

    const executeEvmTx = useCallback(async (evmTx: SkipEvmTx): Promise<EvmTransactionResult> => {
        setIsExecuting(true);

        try {
            const targetChainId = Number(evmTx.chain_id);

            // ── Step 1: Switch chain if needed ─────────────────────────────
            if (currentChainId !== targetChainId) {
                setProgressMessage('Switching network...');
                try {
                    await switchChainAsync({chainId: targetChainId});
                } catch (e: any) {
                    return {success: false, error: `Failed to switch network: ${e?.message || 'Unknown error'}`};
                }
            }

            // ── Step 2: ERC20 approvals ────────────────────────────────────
            const approvals = evmTx.required_erc20_approvals ?? [];
            for (let i = 0; i < approvals.length; i++) {
                const approval = approvals[i];
                setProgressMessage(
                    approvals.length === 1
                        ? 'Approving token...'
                        : `Approving token (${i + 1}/${approvals.length})...`,
                );

                try {
                    const approveTxHash = await writeContractAsync({
                        address: approval.token_contract as `0x${string}`,
                        abi: ERC20_APPROVE_ABI,
                        functionName: 'approve',
                        args: [
                            approval.spender as `0x${string}`,
                            BigInt(approval.amount),
                        ],
                        chainId: targetChainId,
                    });

                    setProgressMessage('Waiting for approval confirmation...');
                    const receipt = await waitForTransactionReceipt(config, {
                        hash: approveTxHash,
                        chainId: targetChainId,
                    });

                    if (receipt.status !== 'success') {
                        return {success: false, error: 'Token approval transaction failed'};
                    }
                } catch (e: any) {
                    if (e?.message?.includes('rejected') || e?.message?.includes('denied')) {
                        return {success: false, error: 'Token approval was rejected'};
                    }
                    return {success: false, error: `Token approval failed: ${e?.message || 'Unknown error'}`};
                }
            }

            // ── Step 3: Bridge transaction ─────────────────────────────────
            setProgressMessage('Sending bridge transaction...');

            try {
                const bridgeTxHash = await sendTransactionAsync({
                    to: evmTx.to as `0x${string}`,
                    data: evmTx.data as `0x${string}`,
                    value: evmTx.value ? BigInt(evmTx.value) : BigInt(0),
                    chainId: targetChainId,
                });

                setProgressMessage('Waiting for confirmation...');
                const receipt = await waitForTransactionReceipt(config, {
                    hash: bridgeTxHash,
                    chainId: targetChainId,
                });

                if (receipt.status !== 'success') {
                    return {success: false, error: 'Bridge transaction failed'};
                }

                return {success: true, txHash: bridgeTxHash};
            } catch (e: any) {
                if (e?.message?.includes('rejected') || e?.message?.includes('denied')) {
                    return {success: false, error: 'Transaction was rejected'};
                }
                return {success: false, error: `Bridge transaction failed: ${e?.message || 'Unknown error'}`};
            }
        } finally {
            setIsExecuting(false);
            setProgressMessage('');
        }
    }, [currentChainId, switchChainAsync, writeContractAsync, sendTransactionAsync, config]);

    return {executeEvmTx, isExecuting, progressMessage};
}
