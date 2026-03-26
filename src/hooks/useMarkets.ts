import {useCallback, useMemo} from "react";
import {useAssetsContext} from "./useAssets";
import {Market, MarketData} from "../types/market";
import {toBigNumber, uAmountToBigNumberAmount} from "../utils/amount";
import {truncateDenom} from "../utils/denom";
import BigNumber from "bignumber.js";

export function useMarkets() {
    const {marketsMap, marketsDataMap, updateMarkets, isLoading} = useAssetsContext()

    const markets = useMemo((): Market[] => {
        return Array.from(marketsMap.values())
    }, [marketsMap])

    const marketsData = useMemo(() => Array.from(marketsDataMap.values()), [marketsDataMap])

    const marketExists = useCallback((marketId: string): boolean => marketsMap.has(marketId), [marketsMap])

    const getMarketData = useCallback((marketId: string): MarketData | undefined => marketsDataMap.get(marketId), [marketsDataMap])
    const getMarket = useCallback((marketId: string): Market | undefined => marketsMap.get(marketId), [marketsMap])

    return {
        markets,
        marketsData,
        marketsMap,
        marketsDataMap,
        isLoading,
        updateMarkets,
        marketExists,
        getMarketData,
        getMarket,
    }
}

export function useAssetMarkets(denom: string) {
    const { isLoading, marketsMap, marketsDataMap } = useAssetsContext()

    const markets = useMemo(() => Array.from(marketsMap.values()), [marketsMap])
    const marketsData = useMemo(() => Array.from(marketsDataMap.values()), [marketsDataMap])

    const assetMarkets = useMemo((): Market[] => {
        const baseMatches = []
        const quoteMatches = []

        for (const market of markets) {
            if (market.base === denom) baseMatches.push(market)
            else if (market.quote === denom) quoteMatches.push(market)
        }

        return [...baseMatches, ...quoteMatches]
    }, [markets, denom])

    const assetMarketsData = useMemo((): MarketData[] => {
        const baseMatches = []
        const quoteMatches = []

        for (const market of marketsData) {
            if (market.base === denom) baseMatches.push(market)
            else if (market.quote === denom) quoteMatches.push(market)
        }

        return [...baseMatches, ...quoteMatches]
    }, [marketsData, denom])

    const asset24hTradedVolume = useMemo((): BigNumber => {
        return assetMarketsData.reduce((acc, market) => {
            if (denom === market.base) {
                return acc.plus(market.base_volume || 0)
            } else if (denom === market.quote) {
                return acc.plus(market.quote_volume || 0)
            }
            return acc
        }, new BigNumber(0))
    }, [assetMarketsData, denom])

    return {
        isLoading,
        assetMarkets,
        assetMarketsData,
        asset24hTradedVolume,
    }
}

/**
 * Hook to get a market by its ID string.
 */
export function useMarket(marketId: string) {
    const { marketsMap, marketsDataMap, isLoading, assetsMap } = useAssetsContext()

    const market = useMemo(() => marketsMap.get(marketId), [marketsMap, marketId])

    const marketSymbol = useMemo((): string => {
        if (isLoading) return ""
        if (!market) return ""

        let base = assetsMap.get(market.base)?.ticker
        if (!base) {
            base = truncateDenom(market.base)
        }

        let quote = assetsMap.get(market.quote)?.ticker
        if (!quote) {
            quote = truncateDenom(market.quote)
        }

        return `${base}/${quote}`
    }, [market, isLoading, assetsMap])

    const marketData = useMemo(() => marketsDataMap.get(marketId), [marketsDataMap, marketId])

    const marketExists = useMemo(() => !!market, [market])

    const volume24h = useMemo(() => {
        if (!marketData || !market) return toBigNumber(0);
        const quoteAsset = assetsMap.get(market.quote);
        if (!quoteAsset) return toBigNumber(0);
        return uAmountToBigNumberAmount(toBigNumber(marketData.quote_volume), quoteAsset.decimals);
    }, [marketData, assetsMap, market])

    return {
        isLoading,
        market,
        marketData,
        marketSymbol,
        marketId,
        marketExists,
        volume24h,
    }
}

export function useMarketsManager() {
    const { updateMarkets, isLoading } = useAssetsContext();
    return {
        updateMarkets,
        isLoading
    };
}
