import {useCallback, useMemo} from "react";
import {useAssetsContext} from "./useAssets";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {createPoolId, poolIdFromPoolDenom, calculatePoolOppositeAmount} from "../utils/liquidity_pool";
import {toBigNumber} from "../utils/amount";
import {Asset} from "../types/asset";
import {LiquidityPoolData} from "../types/liquidity_pool";
import BigNumber from "bignumber.js";

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
        poolsData: poolsDataMap,
        poolsDataMap,
        isLoading,
        updateLiquidityPools,
        getPoolByLpDenom,
        getDenomsPool,
        liquidAssets,
    }
}

export function useAssetLiquidityPools(denom: string) {
    const {poolsMap, poolsDataMap, isLoading} = useAssetsContext()

    const assetPools = useMemo(() => {
        return Array.from(poolsMap.values()).filter(pool =>
            pool.base === denom || pool.quote === denom
        )
    }, [poolsMap, denom])

    const assetPoolsData = useMemo(() => {
        const newMap = new Map<string, LiquidityPoolData>()
        if (isLoading || denom === '') return newMap

        assetPools.forEach(pool => {
            const poolData = poolsDataMap.get(pool.id)
            if (poolData) {
                newMap.set(pool.id, poolData)
            }
        })

        return newMap
    }, [assetPools, poolsDataMap, isLoading, denom])

    const asset24HoursVolume = useMemo(() => {
        let volume = BigNumber(0)
        if (isLoading || denom === '') return volume

        assetPoolsData.forEach((poolData) => {
            if (poolData.base === denom) {
                volume = volume.plus(poolData.baseVolume)
            } else if (poolData.quote === denom) {
                volume = volume.plus(poolData.quoteVolume)
            }
        })

        return volume
    }, [isLoading, assetPoolsData, denom])

    return {
        assetPools,
        poolsDataMap,
        isLoading,
        asset24HoursVolume,
        assetPoolsData,
    }
}

export function useLiquidityPool(poolId: string) {
    const {balancesMap, assetsMap, poolsMap, poolsDataMap, isLoading} = useAssetsContext()

    const pool = useMemo(() => poolsMap.get(poolId), [poolsMap, poolId])
    const poolData = useMemo(() => poolsDataMap.get(poolId), [poolsDataMap, poolId])

    const userShares = useMemo(() => {
        if (!pool) return toBigNumber(0)
        const balance = balancesMap.get(pool.lp_denom)
        if (!balance) return toBigNumber(0)
        return toBigNumber(balance.amount)
    }, [balancesMap, pool])

    const totalShares = useMemo(() => {
        if (!assetsMap || !pool) return toBigNumber(0)
        const sharesAsset = assetsMap.get(pool.lp_denom)
        if (!sharesAsset) return toBigNumber(0)
        return toBigNumber(sharesAsset?.supply || 0)
    }, [assetsMap, pool])

    const userSharesPercentage = useMemo(() => {
        if (!userShares || !totalShares || totalShares.isZero()) {
            return toBigNumber(0);
        }
        return userShares.dividedBy(totalShares).multipliedBy(100).toFixed(2);
    }, [userShares, totalShares])

    const userReserveBase = useMemo(() => {
        if (!pool || !userShares || !totalShares || totalShares.isZero()) {
            return toBigNumber(0);
        }
        const reserveBase = toBigNumber(pool.reserve_base);
        return userShares.dividedBy(totalShares).multipliedBy(reserveBase);
    }, [pool, userShares, totalShares])

    const userReserveQuote = useMemo(() => {
        if (!pool || !userShares || !totalShares || totalShares.isZero()) {
            return toBigNumber(0);
        }
        const reserveQuote = toBigNumber(pool.reserve_quote);
        return userShares.dividedBy(totalShares).multipliedBy(reserveQuote);
    }, [pool, userShares, totalShares])

    const calculateOppositeAmount = useCallback((amount: string | BigNumber, isBase: boolean): BigNumber => {
        if (!pool) {
            return toBigNumber(0);
        }
        return calculatePoolOppositeAmount(pool, amount, isBase);
    }, [pool])

    const calculateSharesFromAmounts = useCallback((baseAmount: string | BigNumber, quoteAmount: string | BigNumber): BigNumber => {
        if (!pool || !totalShares) {
            return toBigNumber(0);
        }

        const baseAmountBN = toBigNumber(baseAmount);
        const quoteAmountBN = toBigNumber(quoteAmount);

        if (baseAmountBN.isZero() || baseAmountBN.isNaN() || quoteAmountBN.isZero() || quoteAmountBN.isNaN()) {
            return toBigNumber(0);
        }

        const reserveBase = toBigNumber(pool.reserve_base);
        const reserveQuote = toBigNumber(pool.reserve_quote);

        if (reserveBase.isZero() || reserveQuote.isZero() || totalShares.isZero()) {
            return toBigNumber(0);
        }

        const baseRatio = baseAmountBN.dividedBy(reserveBase);
        const quoteRatio = quoteAmountBN.dividedBy(reserveQuote);
        const mintRatio = BigNumber.minimum(baseRatio, quoteRatio);
        const tokensToMint = mintRatio.multipliedBy(totalShares);

        return tokensToMint.integerValue(BigNumber.ROUND_DOWN);
    }, [pool, totalShares])

    return {
        isLoading,
        pool,
        poolData,
        userShares,
        totalShares,
        userSharesPercentage,
        userReserveBase,
        userReserveQuote,
        calculateOppositeAmount,
        calculateSharesFromAmounts,
    }
}
