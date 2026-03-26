import {getChainNativeAssetDenom, getUSDCDenom} from "../constants/assets";
import {createMarketId} from "../utils/market";
import BigNumber from "bignumber.js";
import {useCallback, useMemo} from "react";
import {useAssetsContext} from "./useAssets";
import {toBigNumber, uAmountToBigNumberAmount} from "../utils/amount";

export function useAssetPrice(denom: string) {
    const {usdPricesMap, marketsDataMap, isLoadingPrices} = useAssetsContext()

    const usdDenom = useMemo(() => getUSDCDenom(), []);
    const bzeDenom = useMemo(() => getChainNativeAssetDenom(), [])

    const change = useMemo(() => {
        const marketData = marketsDataMap.get(createMarketId(denom, usdDenom))
        if (marketData) {
            return marketData.change
        }

        const marketData2 = marketsDataMap.get(createMarketId(denom, bzeDenom))
        if (marketData2) {
            return marketData2.change
        }

        return 0
    }, [marketsDataMap, denom, usdDenom, bzeDenom]);

    const price = useMemo(() => {
        const zeroBN = toBigNumber(0)
        if (denom === '') return zeroBN;

        if (denom === usdDenom) return toBigNumber(1)

        return usdPricesMap.get(denom) || zeroBN
    }, [usdPricesMap, denom, usdDenom]);

    const totalUsdValue = useCallback((amount: BigNumber): BigNumber => {
        return price.multipliedBy(amount)
    }, [price]);

    const uAmountUsdValue = useCallback((amount: BigNumber, decimals: number): BigNumber => {
        return totalUsdValue(uAmountToBigNumberAmount(amount, decimals))
    }, [totalUsdValue]);

    const isUSDC = useMemo(() => denom === usdDenom, [denom, usdDenom]);
    const hasPrice = useMemo(() => price.gt(0), [price]);

    return {
        price,
        change,
        totalUsdValue,
        uAmountUsdValue,
        isLoading: isLoadingPrices,
        hasPrice,
        isUSDC,
    }
}
