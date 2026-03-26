import { useMemo } from "react";
import { useLiquidityPools } from "./useLiquidityPools";
import { getChainNativeAssetDenom } from "../constants/assets";
import { useAssetsContext } from "./useAssets";
import {toBigNumber} from "../utils/amount";

const MIN_LIQUIDITY_FOR_FEE_TOKEN = 50000000000;

export function useFeeTokens() {
    const { pools, isLoading: poolsLoading } = useLiquidityPools();
    const { assetsMap, isLoading: assetsLoading } = useAssetsContext();
    const nativeDenom = getChainNativeAssetDenom();

    const feeTokens = useMemo(() => {
        if (poolsLoading || assetsLoading) {
            return [];
        }

        const feeTokenDenoms = new Set<string>();

        pools.forEach(pool => {
            if (pool.base === nativeDenom && toBigNumber(pool.reserve_base).gt(MIN_LIQUIDITY_FOR_FEE_TOKEN)) {
                feeTokenDenoms.add(pool.quote);
            } else if (pool.quote === nativeDenom && toBigNumber(pool.reserve_quote).gt(MIN_LIQUIDITY_FOR_FEE_TOKEN)) {
                feeTokenDenoms.add(pool.base);
            }
        });

        const tokens = Array.from(feeTokenDenoms)
            .map(denom => assetsMap.get(denom))
            .filter(asset => asset !== undefined)
            .sort((a, b) => {
                if (!a || !b) return 0;
                return a.denom.localeCompare(b.denom);
            })

        const bzeAsset = assetsMap.get(nativeDenom);
        if (!bzeAsset) {
            return tokens;
        }

        return [bzeAsset, ...tokens];
    }, [pools, poolsLoading, assetsLoading, nativeDenom, assetsMap]);

    return {
        feeTokens,
        isLoading: poolsLoading || assetsLoading,
        nativeDenom
    };
}
