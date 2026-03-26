import {useCallback, useMemo} from "react";
import {useAssetsContext} from "./useAssets";
import {Market} from "../types/market";
import {createMarketId} from "../utils/market";
import {toBigNumber, uAmountToBigNumberAmount} from "../utils/amount";
import BigNumber from "bignumber.js";

export function useMarkets() {
    const {marketsMap, marketsDataMap, updateMarkets, isLoading} = useAssetsContext()

    const markets = useMemo((): Market[] => {
        return Array.from(marketsMap.values())
    }, [marketsMap])

    return {
        markets,
        marketsMap,
        marketsDataMap,
        isLoading,
        updateMarkets,
    }
}

export function useAssetMarkets(denom: string) {
    const {marketsMap} = useAssetsContext()

    const assetMarkets = useMemo(() => {
        return Array.from(marketsMap.values()).filter(market =>
            market.base === denom || market.quote === denom
        )
    }, [marketsMap, denom])

    return {
        assetMarkets,
    }
}

export function useMarket(base: string, quote: string) {
    const {marketsMap, marketsDataMap, assetsMap, isLoading} = useAssetsContext()

    const marketId = useMemo(() => createMarketId(base, quote), [base, quote]);

    const market = useMemo(() => {
        return marketsMap.get(marketId)
    }, [marketsMap, marketId])

    const marketData = useMemo(() => {
        return marketsDataMap.get(marketId)
    }, [marketsDataMap, marketId])

    const marketExists = useMemo(() => !!market, [market]);

    const volume24h = useMemo(() => {
        if (!marketData) return toBigNumber(0);
        const quoteAsset = assetsMap.get(quote);
        if (!quoteAsset) return toBigNumber(0);
        return uAmountToBigNumberAmount(toBigNumber(marketData.quote_volume), quoteAsset.decimals);
    }, [marketData, assetsMap, quote]);

    return {
        market,
        marketData,
        marketExists,
        volume24h,
        isLoading,
    }
}
