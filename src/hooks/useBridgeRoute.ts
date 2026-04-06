'use client'

import {useEffect, useState} from 'react';
import type {RoutePreview, TransferDirection} from '../types/cross_chain';
import type {BridgeableAsset} from './useBridgeableAssets';

interface UseBridgeRouteReturn {
    routePreview: RoutePreview | undefined;
    isLoading: boolean;
    error: string;
}

/**
 * Build a pure-IBC route preview for the selected bridgeable asset + amount.
 *
 * At the moment the bridge is IBC-only: output = input, no fees, ~30s
 * relayer time. Skip-routed deposits will be layered on in a later phase
 * when we re-introduce the mechanism selection logic.
 *
 * The hook still returns the same `RoutePreview` shape as the old
 * Skip-aware implementation so the form renderer and transfer hook don't
 * need to change.
 */
export function useBridgeRoute(
    direction: TransferDirection,
    asset: BridgeableAsset | undefined,
    amount: string,
): UseBridgeRouteReturn {
    const [routePreview, setRoutePreview] = useState<RoutePreview | undefined>();
    const [isLoading] = useState(false);
    const [error] = useState('');

    useEffect(() => {
        if (!asset || !amount || amount === '0' || parseFloat(amount) <= 0) {
            setRoutePreview(undefined);
            return;
        }
        setRoutePreview({
            estimatedOutput: amount,
            estimatedOutputTicker: asset.bzeAsset.ticker,
            estimatedDurationSeconds: 30,
            fees: [],
            txsRequired: 1,
            mechanism: 'ibc',
            warning: undefined,
            rawRoute: undefined,
        });
        // direction is currently unused — IBC in/out looks the same in the
        // preview — but we keep it in the signature so the form can pass it
        // through unchanged and Phase 2 (Skip) can differentiate deposits.
        void direction;
    }, [asset, amount, direction]);

    return {routePreview, isLoading, error};
}
