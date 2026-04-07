'use client'

import {useEffect, useMemo, useState} from "react";
import {skipGetChains} from "../query/skip";
import {getWalletChainsNames} from "../constants/chain";
import type {SkipChain} from "../types/cross_chain";
import {useEvmWalletState} from "../evm/context";

/**
 * A Skip chain enriched with a `canSign` flag indicating whether the
 * current app can sign transactions on it (chain registered with
 * ChainProvider + Cosmos type).
 */
export interface SkipChainWithStatus extends SkipChain {
    /** True when the chain is Cosmos AND registered with ChainProvider — we can useChain() on it. */
    canSign: boolean;
}

export interface UseSkipChainsResult {
    chains: SkipChainWithStatus[];
    isLoading: boolean;
    error: string;
}

/**
 * Fetches all Skip-supported chains (cached 5min by `skipGetChains`),
 * filters out testnets, and annotates each with `canSign`:
 *
 *   • Cosmos chains in `getWalletChainsNames()` → `canSign: true`
 *   • EVM chains / unregistered Cosmos chains → `canSign: false`
 *     (shown in the picker with a "Coming soon" badge, not selectable)
 *
 * The chain list excludes BZE itself (it's the destination, not a source).
 */
export function useSkipChains(): UseSkipChainsResult {
    const [allChains, setAllChains] = useState<SkipChain[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError('');

        skipGetChains()
            .then(chains => {
                if (cancelled) return;
                setAllChains(chains ?? []);
            })
            .catch(e => {
                if (cancelled) return;
                console.error('[useSkipChains] error:', e);
                setError('Could not load chains from Skip');
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    const {isAvailable: evmAvailable} = useEvmWalletState();

    const chains = useMemo<SkipChainWithStatus[]>(() => {
        if (allChains.length === 0) return [];

        // Build a set of chain names registered with ChainProvider
        const registeredNames = new Set<string>(
            getWalletChainsNames().map((c: any) => (c.chainName || '').toLowerCase()),
        );

        return allChains
            .filter(c => !c.is_testnet)
            // Exclude BZE itself — it's the destination
            .filter(c => c.chain_id !== 'beezee-1')
            .map(c => ({
                ...c,
                canSign:
                    // Cosmos: must be registered with ChainProvider
                    (c.chain_type === 'cosmos' && registeredNames.has((c.chain_name || '').toLowerCase()))
                    // EVM: selectable when EvmProvider is in the tree (wallet
                    // connect happens inline after chain selection, not upfront)
                    || (c.chain_type === 'evm' && evmAvailable),
            }))
            // Signable chains first, then alphabetical by name
            .sort((a, b) => {
                if (a.canSign !== b.canSign) return a.canSign ? -1 : 1;
                return (a.chain_name || '').localeCompare(b.chain_name || '');
            });
    }, [allChains, evmAvailable]);

    return {chains, isLoading, error};
}
