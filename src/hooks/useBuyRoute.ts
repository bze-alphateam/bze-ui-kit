'use client'

import {useCallback, useEffect, useRef, useState} from 'react';
import type {RoutePreview, SkipRouteResponse} from '../types/cross_chain';
import {BZE_SKIP_CHAIN_ID, BZE_NATIVE_DENOM} from '../constants/cross_chain';
import {skipGetRoute} from '../query/skip';
import {amountToUAmount} from '../utils/amount';
import {addDebounce, cancelDebounce} from '../utils/debounce';

const DEBOUNCE_KEY = 'buy-bze-route';
const DEBOUNCE_MS = 500;

export interface UseBuyRouteResult {
    routePreview: RoutePreview | undefined;
    rawRoute: SkipRouteResponse | undefined;
    isLoading: boolean;
    error: string;
}

/**
 * Debounced route lookup for the Buy BZE flow. Hardcodes the destination
 * to `beezee-1` / `ubze` — the user only picks the source chain + asset +
 * amount.
 *
 * Returns a `RoutePreview` (for the UI preview box) and the raw
 * `SkipRouteResponse` (for passing to `useSkipBridgeTransfer` when
 * executing). Debounced 500ms to avoid hammering the API while the user
 * is typing.
 */
export function useBuyRoute(
    sourceChainId: string | undefined,
    sourceAssetDenom: string | undefined,
    sourceAssetDecimals: number | undefined,
    amount: string,
): UseBuyRouteResult {
    const [routePreview, setRoutePreview] = useState<RoutePreview | undefined>();
    const [rawRoute, setRawRoute] = useState<SkipRouteResponse | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const requestIdRef = useRef(0);

    const fetchRoute = useCallback(async (
        chainId: string,
        denom: string,
        decimals: number,
        amt: string,
        reqId: number,
    ) => {
        const uAmount = amountToUAmount(amt, decimals);

        const routeRequest = {
            source_asset_denom: denom,
            source_asset_chain_id: chainId,
            dest_asset_denom: BZE_NATIVE_DENOM,
            dest_asset_chain_id: BZE_SKIP_CHAIN_ID,
            amount_in: uAmount,
            allow_swaps: true,
        };
        console.log('[useBuyRoute] requesting route:', routeRequest);
        const route = await skipGetRoute(routeRequest);

        // Stale request check
        if (reqId !== requestIdRef.current) return;

        if (!route) {
            setRoutePreview(undefined);
            setRawRoute(undefined);
            setError('We couldn\u2019t find a way to swap this asset into BZE. Try a different asset or amount.');
            setIsLoading(false);
            return;
        }

        // Build the UI-friendly preview
        const fees = (route.estimated_fees || []).map(fee => ({
            amount: fee.amount,
            ticker: fee.origin_asset?.denom || '',
            usdValue: fee.usd_amount,
        }));

        // BZE has 6 decimals — convert amount_out from ubze
        const bzeDecimals = 6;
        const rawOut = BigInt(route.amount_out || '0');
        const outputHuman = (Number(rawOut) / Math.pow(10, bzeDecimals)).toFixed(bzeDecimals);

        const preview: RoutePreview = {
            estimatedOutput: outputHuman,
            estimatedOutputTicker: 'BZE',
            estimatedDurationSeconds: route.estimated_route_duration_seconds || 60,
            fees,
            txsRequired: route.txs_required,
            mechanism: 'skip',
            warning: route.warning?.message,
            rawRoute: route,
        };

        setRoutePreview(preview);
        setRawRoute(route);
        setError('');
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!sourceChainId || !sourceAssetDenom || !sourceAssetDecimals || !amount || amount === '0' || parseFloat(amount) <= 0) {
            setRoutePreview(undefined);
            setRawRoute(undefined);
            setError('');
            setIsLoading(false);
            cancelDebounce(DEBOUNCE_KEY);
            return;
        }

        const reqId = ++requestIdRef.current;
        setIsLoading(true);
        setError('');

        addDebounce(DEBOUNCE_KEY, DEBOUNCE_MS, () => {
            fetchRoute(sourceChainId, sourceAssetDenom, sourceAssetDecimals, amount, reqId).catch((e) => {
                if (reqId !== requestIdRef.current) return;
                console.error('[useBuyRoute] error:', e);
                setError('Could not check available routes. Please try again.');
                setIsLoading(false);
            });
        });

        return () => {
            cancelDebounce(DEBOUNCE_KEY);
        };
    }, [sourceChainId, sourceAssetDenom, sourceAssetDecimals, amount, fetchRoute]);

    return {routePreview, rawRoute, isLoading, error};
}
