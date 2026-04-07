'use client'

import {useCallback, useEffect, useRef, useState} from 'react';
import type {CrossChainTxRecord, CrossChainTxState} from '../types/cross_chain';
import {skipGetTxStatus, skipTrackTx} from '../query/skip';
import {getFromLocalStorage, setInLocalStorage} from '../storage/storage';
import {useToast} from './useToast';
import {useAssetsContext} from './useAssets';
import {generateTxRecordId} from '../utils/cross_chain';

const STORAGE_KEY = 'skip:pending-txs';
const TTL_SECONDS = 3600; // 1 hour
const POLL_INTERVAL_MS = 10_000; // 10 seconds
const MAX_AGE_MS = 3600_000; // 1 hour

const TERMINAL_STATES: CrossChainTxState[] = ['completed', 'failed', 'abandoned'];

const mapSkipState = (skipState: string): CrossChainTxState => {
    switch (skipState) {
        case 'STATE_SUBMITTED': return 'submitted';
        case 'STATE_PENDING': return 'pending';
        case 'STATE_COMPLETED_SUCCESS': return 'completed';
        case 'STATE_COMPLETED_ERROR': return 'failed';
        case 'STATE_ABANDONED': return 'abandoned';
        default: return 'pending';
    }
};

const isTerminal = (state: CrossChainTxState): boolean => TERMINAL_STATES.includes(state);

const loadRecords = (): CrossChainTxRecord[] => {
    const raw = getFromLocalStorage(STORAGE_KEY);
    if (!raw) return [];
    try {
        const records: CrossChainTxRecord[] = JSON.parse(raw);
        const now = Date.now();
        return records.filter(r => now - r.timestamp < MAX_AGE_MS);
    } catch {
        return [];
    }
};

const saveRecords = (records: CrossChainTxRecord[]) => {
    setInLocalStorage(STORAGE_KEY, JSON.stringify(records), TTL_SECONDS);
};

export interface UseSkipTxTrackerReturn {
    transactions: CrossChainTxRecord[];
    addTransaction: (partial: Omit<CrossChainTxRecord, 'id' | 'timestamp' | 'state'> & { state?: CrossChainTxState }) => void;
    dismissTransaction: (id: string) => void;
}

export function useSkipTxTracker(): UseSkipTxTrackerReturn {
    const [transactions, setTransactions] = useState<CrossChainTxRecord[]>(loadRecords);
    const {toast} = useToast();
    const {updateBalances} = useAssetsContext();

    const notifiedRef = useRef<Set<string>>(new Set());
    // Keep a ref to the latest transactions so the polling interval doesn't
    // need to be in the dependency array (which would cause restart loops).
    const txRef = useRef(transactions);
    txRef.current = transactions;

    const toastRef = useRef(toast);
    toastRef.current = toast;
    const updateBalancesRef = useRef(updateBalances);
    updateBalancesRef.current = updateBalances;

    // ─── Persist on every change ───────────────────────────────────────────
    useEffect(() => {
        saveRecords(transactions);
    }, [transactions]);

    // ─── On mount: re-track any non-terminal txs loaded from localStorage ──
    // This handles page refresh, tab reopen after 30 min, etc. Skip requires
    // POST /v2/tx/track before GET /v2/tx/status works. Track calls are
    // idempotent so calling them again is safe.
    const hasBootstrapped = useRef(false);
    useEffect(() => {
        if (hasBootstrapped.current) return;
        hasBootstrapped.current = true;

        const current = txRef.current;
        const pending = current.filter(t => !isTerminal(t.state) && t.txHash && t.broadcastChainId);
        if (pending.length === 0) return;

        (async () => {
            const updates = new Map<string, string>(); // id → explorerLink
            for (const tx of pending) {
                if (!tx.txHash || !tx.broadcastChainId) continue;
                const explorerLink = await skipTrackTx(tx.txHash, tx.broadcastChainId);
                if (explorerLink && !tx.explorerLink) {
                    updates.set(tx.id, explorerLink);
                }
            }
            // Apply explorer links via immutable state update (no direct mutation)
            if (updates.size > 0) {
                setTransactions(prev => prev.map(t => {
                    const link = updates.get(t.id);
                    return link ? {...t, explorerLink: link} : t;
                }));
            }
        })();
    }, []);

    // ─── Polling — runs once, uses refs to avoid restart loops ─────────────
    useEffect(() => {
        const poll = async () => {
            const current = txRef.current;
            const pending = current.filter(t => !isTerminal(t.state) && t.txHash && t.broadcastChainId);
            if (pending.length === 0) return;

            let changed = false;

            for (const tx of pending) {
                if (!tx.txHash || !tx.broadcastChainId) continue;

                try {
                    let status = await skipGetTxStatus({
                        tx_hash: tx.txHash,
                        chain_id: tx.broadcastChainId,
                    });

                    // If status is not found, the tx might not be tracked yet — register it
                    if (!status) {
                        await skipTrackTx(tx.txHash, tx.broadcastChainId);
                        continue;
                    }

                    const newState = mapSkipState(status.state);
                    const stateChanged = newState !== tx.state;
                    const statusChanged = stateChanged || JSON.stringify(status) !== JSON.stringify(tx.lastStatus);

                    if (statusChanged) {
                        changed = true;
                    }

                    if (stateChanged) {
                        // Toast on terminal state (once per tx)
                        if (isTerminal(newState) && !notifiedRef.current.has(tx.id)) {
                            notifiedRef.current.add(tx.id);
                            if (newState === 'completed') {
                                toastRef.current.success(
                                    'Buy completed',
                                    `Received ~${tx.estimatedAmountOut} BZE`,
                                );
                                updateBalancesRef.current();
                            } else {
                                toastRef.current.error(
                                    'Buy failed',
                                    tx.error || 'The transaction did not complete successfully.',
                                );
                            }
                        }
                    }

                    // Mutate in place — we'll clone the whole array below
                    tx.state = newState;
                    tx.lastStatus = status;
                    if (status.error?.message) tx.error = status.error.message;
                } catch {
                    // Polling failure is non-critical — retry next interval
                }
            }

            if (changed) {
                // Clone the array + each record so React sees the change
                setTransactions(prev => prev.map(t => ({...t})));
            }
        };

        // Initial poll after a short delay (let the component settle)
        const initialTimeout = setTimeout(poll, 2000);
        const interval = setInterval(poll, POLL_INTERVAL_MS);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
    }, []); // Empty deps — runs once, uses refs for latest state

    // ─── Public API ────────────────────────────────────────────────────────
    const addTransaction = useCallback((
        partial: Omit<CrossChainTxRecord, 'id' | 'timestamp' | 'state'> & { state?: CrossChainTxState },
    ) => {
        const record: CrossChainTxRecord = {
            ...partial,
            id: generateTxRecordId(),
            timestamp: Date.now(),
            state: partial.state ?? 'submitted',
        };
        // Register with Skip's tracking API — required before status polling works
        if (record.txHash && record.broadcastChainId) {
            skipTrackTx(record.txHash, record.broadcastChainId)
                .then(explorerLink => {
                    if (explorerLink) {
                        setTransactions(prev => prev.map(t =>
                            t.id === record.id ? {...t, explorerLink} : t,
                        ));
                    }
                })
                .catch(() => { /* Non-critical */ });
        }
        setTransactions(prev => [record, ...prev]);
    }, []);

    const dismissTransaction = useCallback((id: string) => {
        setTransactions(prev => prev.filter(t => t.id !== id));
    }, []);

    return {transactions, addTransaction, dismissTransaction};
}
