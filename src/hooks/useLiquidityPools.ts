import {useMemo} from "react";
import {useAssetsContext} from "./useAssets";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {poolIdFromPoolDenom} from "../utils/liquidity_pool";

export function useLiquidityPools() {
    const {poolsMap, poolsDataMap, updateLiquidityPools, isLoading} = useAssetsContext()

    const pools = useMemo((): LiquidityPoolSDKType[] => {
        return Array.from(poolsMap.values())
    }, [poolsMap])

    const getPoolByLpDenom = (lpDenom: string) => {
        const poolId = poolIdFromPoolDenom(lpDenom);
        return poolsMap.get(poolId);
    }

    return {
        pools,
        poolsMap,
        poolsDataMap,
        isLoading,
        updateLiquidityPools,
        getPoolByLpDenom,
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
