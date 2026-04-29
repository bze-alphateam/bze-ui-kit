import { useMemo, useEffect, useState, useCallback } from "react";
import { useLiquidityPools } from "./useLiquidityPools";
import { getChainNativeAssetDenom } from "../constants/assets";
import { useAssetsContext } from "./useAssets";
import { useSettings } from "./useSettings";
import { toBigNumber } from "../utils/amount";
import { getTradebinParams } from "../query/tradebin_params";

// Fallback if on-chain params can't be fetched
const DEFAULT_MIN_LIQUIDITY_FOR_FEE_TOKEN = 100000000000;

export function useFeeTokens() {
    const { pools, isLoading: poolsLoading } = useLiquidityPools();
    const { assetsMap, isLoading: assetsLoading } = useAssetsContext();
    const { feeDenom, updatePreferredFeeDenom } = useSettings();
    const nativeDenom = getChainNativeAssetDenom();

    const [minLiquidity, setMinLiquidity] = useState<number>(DEFAULT_MIN_LIQUIDITY_FOR_FEE_TOKEN);

    // Fetch on-chain min liquidity param (cached for 5 minutes)
    useEffect(() => {
        getTradebinParams().then(params => {
            if (params?.minNativeLiquidityForModuleSwap) {
                const val = Number(params.minNativeLiquidityForModuleSwap);
                if (!isNaN(val) && val > 0) {
                    setMinLiquidity(val);
                }
            }
        });
    }, []);

    const feeTokens = useMemo(() => {
        if (poolsLoading || assetsLoading) {
            return [];
        }

        const feeTokenDenoms = new Set<string>();

        pools.forEach(pool => {
            if (pool.base === nativeDenom && toBigNumber(pool.reserve_base).gt(minLiquidity)) {
                feeTokenDenoms.add(pool.quote);
            } else if (pool.quote === nativeDenom && toBigNumber(pool.reserve_quote).gt(minLiquidity)) {
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
    }, [pools, poolsLoading, assetsLoading, nativeDenom, assetsMap, minLiquidity]);

    // Valid fee denoms derived from feeTokens
    const validFeeDenoms = useMemo(() => {
        return new Set(feeTokens.map(t => t.denom));
    }, [feeTokens]);

    // Auto-reset preferred fee denom if it's no longer valid (e.g. liquidity dropped)
    useEffect(() => {
        if (poolsLoading || assetsLoading || feeTokens.length === 0) {
            return;
        }

        if (feeDenom !== nativeDenom && !validFeeDenoms.has(feeDenom)) {
            updatePreferredFeeDenom(undefined);
        }
    }, [feeDenom, nativeDenom, validFeeDenoms, poolsLoading, assetsLoading, feeTokens.length, updatePreferredFeeDenom]);

    const isValidFeeDenom = useCallback((denom: string): boolean => {
        return denom === nativeDenom || validFeeDenoms.has(denom);
    }, [nativeDenom, validFeeDenoms]);

    return {
        feeTokens,
        isLoading: poolsLoading || assetsLoading,
        nativeDenom,
        isValidFeeDenom,
        minLiquidity,
    };
}
