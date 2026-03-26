import {useCallback, useMemo} from "react";
import {useAssetsContext} from "./useAssets";
import {toBigNumber, uAmountToBigNumberAmount} from "../utils/amount";
import BigNumber from "bignumber.js";
import {PrettyBalance} from "../types/balance";

export function useAssetsValue() {
    const {assetsMap, usdPricesMap, balancesMap, isLoading: isLoadingPrices} = useAssetsContext()

    const totalUsdValue = useMemo(() => {
        let total = toBigNumber(0)
        balancesMap.forEach((balance, denom) => {
            const price = usdPricesMap.get(denom)
            if (!price || !price.gt(0)) return

            const asset = assetsMap.get(denom)
            if (!asset) return

            total = total.plus(price.multipliedBy(uAmountToBigNumberAmount(balance.amount, asset.decimals)))
        })
        return total
    }, [balancesMap, usdPricesMap, assetsMap])

    const denomUsdValue = useCallback((denom: string, uAmount: BigNumber): BigNumber => {
        const price = usdPricesMap.get(denom)
        if (!price || !price.gt(0)) return toBigNumber(0)

        const asset = assetsMap.get(denom)
        if (!asset) return toBigNumber(0)

        return price.multipliedBy(uAmountToBigNumberAmount(uAmount, asset.decimals))
    }, [usdPricesMap, assetsMap])

    const compareValues = useCallback((a: PrettyBalance, b: PrettyBalance) => {
        let aValue = BigNumber(0)
        const aPrice = usdPricesMap.get(a.denom)
        if (aPrice) {
            aValue = aPrice.multipliedBy(a.amount)
        }
        let bValue = BigNumber(0)
        const bPrice = usdPricesMap.get(b.denom)
        if (bPrice) {
            bValue = bPrice.multipliedBy(b.amount)
        }

        return aValue.comparedTo(bValue) ?? 0
    }, [usdPricesMap])

    return {
        totalUsdValue,
        denomUsdValue,
        compareValues,
        isLoading: isLoadingPrices,
    }
}
