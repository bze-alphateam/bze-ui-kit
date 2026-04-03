'use client'

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AllowedAsset, AllowedChain, RoutePreview, TransferDirection } from '../types/cross_chain';
import { getTransferMechanism } from '../constants/cross_chain';
import { BZE_SKIP_CHAIN_ID, BZE_NATIVE_DENOM } from '../constants/cross_chain';
import { skipGetRoute } from '../query/skip';
import { buildRoutePreview, buildIbcRoutePreview } from '../utils/cross_chain';
import { amountToUAmount } from '../utils/amount';
import { addDebounce, cancelDebounce } from '../utils/debounce';

const DEBOUNCE_KEY = 'bridge-route';
const DEBOUNCE_MS = 500;

interface UseBridgeRouteReturn {
  routePreview: RoutePreview | undefined;
  isLoading: boolean;
  error: string;
}

export function useBridgeRoute(
  direction: TransferDirection,
  chain: AllowedChain | undefined,
  asset: AllowedAsset | undefined,
  amount: string,
): UseBridgeRouteReturn {
  const [routePreview, setRoutePreview] = useState<RoutePreview | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  const fetchRoute = useCallback(async (
    dir: TransferDirection,
    ch: AllowedChain,
    ast: AllowedAsset,
    amt: string,
    reqId: number,
  ) => {
    const mechanism = getTransferMechanism(ch.chainName);

    // Pure IBC — no API call needed
    if (mechanism === 'ibc') {
      setRoutePreview(buildIbcRoutePreview(amt, ast));
      setIsLoading(false);
      setError('');
      return;
    }

    // Skip-powered route
    const uAmount = amountToUAmount(amt, ast.decimals);
    const sourceDenom = ast.skipDenom || ast.sourceDenom;
    const bzeDenom = ast.bzeDenom || BZE_NATIVE_DENOM;

    const request = dir === 'deposit'
      ? {
          source_asset_denom: sourceDenom,
          source_asset_chain_id: ch.skipChainId,
          dest_asset_denom: bzeDenom,
          dest_asset_chain_id: BZE_SKIP_CHAIN_ID,
          amount_in: uAmount,
        }
      : {
          source_asset_denom: bzeDenom,
          source_asset_chain_id: BZE_SKIP_CHAIN_ID,
          dest_asset_denom: sourceDenom,
          dest_asset_chain_id: ch.skipChainId,
          amount_in: uAmount,
        };

    const route = await skipGetRoute(request);

    // Stale request check
    if (reqId !== requestIdRef.current) return;

    if (!route) {
      setRoutePreview(undefined);
      setError('No route available for this transfer');
      setIsLoading(false);
      return;
    }

    const destAsset = dir === 'deposit'
      ? { ...ast, ticker: ast.bzeDenom ? ast.ticker : 'BZE', decimals: ast.bzeDenom ? ast.decimals : 6 }
      : ast;

    setRoutePreview(buildRoutePreview(route, destAsset, mechanism));
    setError('');
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Clear state if inputs are missing or amount is empty/zero
    if (!chain || !asset || !amount || amount === '0' || parseFloat(amount) <= 0) {
      setRoutePreview(undefined);
      setError('');
      setIsLoading(false);
      cancelDebounce(DEBOUNCE_KEY);
      return;
    }

    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setError('');

    addDebounce(DEBOUNCE_KEY, DEBOUNCE_MS, () => {
      fetchRoute(direction, chain, asset, amount, reqId).catch((e) => {
        if (reqId !== requestIdRef.current) return;
        console.error('[useBridgeRoute] error:', e);
        setError('Could not reach the network. Please check your connection.');
        setIsLoading(false);
      });
    });

    return () => {
      cancelDebounce(DEBOUNCE_KEY);
    };
  }, [direction, chain, asset, amount, fetchRoute]);

  return { routePreview, isLoading, error };
}
