'use client';

import {useCallback, useContext, useMemo} from 'react';
import {AssetsContext, AssetsContextType} from '../contexts/assets_context';
import {getChainNativeAssetDenom} from "../constants/assets";
import {Asset} from "../types/asset";
import {isLpDenom, truncateDenom} from "../utils/denom";

export function useAssetsContext(): AssetsContextType {
    const context = useContext(AssetsContext);
    if (context === undefined) {
        throw new Error('useAssets must be used within an AssetsProvider');
    }
    return context;
}

export function useAssets() {
    const { assetsMap, isLoading } = useAssetsContext();

    const nativeAsset = useMemo(() =>
            assetsMap.get(getChainNativeAssetDenom()) as Asset,
        [assetsMap]
    );

    const assets = useMemo(() =>
            Array.from(assetsMap.values()),
        [assetsMap]
    );

    const isVerifiedAsset = useCallback((denom: string) => {
        const asset = assetsMap.get(denom)
        if (!asset) {
            return false
        }

        return asset.verified
    }, [assetsMap])

    const denomTicker = useCallback((denom: string) => {
        const asset = assetsMap.get(denom)
        if (!asset) {
            return truncateDenom(denom)
        }

        return asset.ticker
    }, [assetsMap])

    const denomDecimals = useCallback((denom: string) => {
        const asset = assetsMap.get(denom)
        if (!asset) {
            return 0
        }

        return asset.decimals
    }, [assetsMap])

    const getAsset = useCallback((denom: string) => {
        return assetsMap.get(denom)
    }, [assetsMap])

    const assetsLpExcluded = useMemo(() => {
        return assets?.filter(item => !isLpDenom(item.denom))
    }, [assets])

    return {
        assets,
        isLoading,
        nativeAsset,
        isVerifiedAsset,
        denomTicker,
        denomDecimals,
        getAsset,
        assetsLpExcluded,
    };
}

export function useAsset(denom: string) {
    const { assetsMap, isLoading } = useAssetsContext();

    const asset = useMemo(() =>
            assetsMap.get(denom),
        [assetsMap, denom]
    );

    return {
        asset,
        isLoading,
    };
}

export function useAssetsManager() {
    const { updateAssets, isLoading } = useAssetsContext();
    return {
        updateAssets,
        isLoading
    };
}

export function useIBCChains() {
    const {ibcChains, isLoading} = useAssetsContext()

    return {
        ibcChains,
        isLoading
    }
}
