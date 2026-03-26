import {useCallback, useMemo} from "react";
import {useAssetsContext} from "./useAssets";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {createPoolId, poolIdFromPoolDenom} from "../utils/liquidity_pool";
import {Asset} from "../types/asset";

export function useLiquidityPools() {
    const {poolsMap, poolsDataMap, updateLiquidityPools, isLoading, assetsMap} = useAssetsContext()

    const pools = useMemo((): LiquidityPoolSDKType[] => {
        return Array.from(poolsMap.values())
    }, [poolsMap])

    const getPoolByLpDenom = (lpDenom: string) => {
        const poolId = poolIdFromPoolDenom(lpDenom);
        return poolsMap.get(poolId);
    }

    const getDenomsPool = useCallback((denomA: string, denomB: string) => {
        const poolId = createPoolId(denomA, denomB)
        return poolsMap.get(poolId)
    }, [poolsMap])

    const liquidAssets = useMemo(() => {
        if (!assetsMap || assetsMap.size === 0) return [];

        const result = new Map<string, Asset|undefined>();
        pools.forEach(pool => {
            result.set(pool.base, assetsMap.get(pool.base))
            result.set(pool.quote, assetsMap.get(pool.quote))
        })

        return Array.from(result.values()).filter(asset => asset !== undefined)
    }, [assetsMap, pools])

    return {
        pools,
        poolsMap,
        poolsDataMap,
        isLoading,
        updateLiquidityPools,
        getPoolByLpDenom,
        getDenomsPool,
        liquidAssets,
    }
}

export function useAssetLiquidityPools(denom: string) {
    const {poolsMap, poolsDataMap} = useAssetsContext()

    const assetPools = useMemo(() => {
        return Array.from(poolsMap.values()).filter(pool =>
            pool.base === denom || pool.quote === denom
        )
    }, [poolsMap, denom])

    return {
        assetPools,
        poolsDataMap,
    }
}
