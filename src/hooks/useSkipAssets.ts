'use client'

import {useEffect, useMemo, useState} from "react";
import {skipGetAssets} from "../query/skip";
import type {SkipAsset} from "../types/cross_chain";

export interface UseSkipAssetsResult {
    assets: SkipAsset[];
    isLoading: boolean;
    error: string;
}

/**
 * Fetches the asset catalog for a specific chain from Skip (cached 5min by
 * `skipGetAssets`). Filters out entries with no `symbol` or `decimals` since
 * they're unusable in the UI.
 *
 * Sorted alphabetically by symbol for the picker.
 */
export function useSkipAssets(chainId: string | undefined): UseSkipAssetsResult {
    const [rawAssets, setRawAssets] = useState<SkipAsset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!chainId) {
            setRawAssets([]);
            setIsLoading(false);
            setError('');
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError('');

        skipGetAssets(chainId)
            .then(assets => {
                if (cancelled) return;
                setRawAssets(assets ?? []);
            })
            .catch(e => {
                if (cancelled) return;
                console.error('[useSkipAssets] error:', e);
                setError('Could not load assets');
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [chainId]);

    const assets = useMemo<SkipAsset[]>(() => {
        return rawAssets
            .filter(a => a.symbol && a.decimals !== undefined && a.decimals > 0)
            .sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
    }, [rawAssets]);

    return {assets, isLoading, error};
}
