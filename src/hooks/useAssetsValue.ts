import {useMemo} from "react";
import {useAssetsContext} from "./useAssets";
import {toBigNumber, uAmountToBigNumberAmount} from "../utils/amount";
import BigNumber from "bignumber.js";

export function useAssetsValue() {
    const {assetsMap, usdPricesMap, balancesMap, isLoading} = useAssetsContext()

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

    const denomUsdValue = (denom: string, uAmount: BigNumber): BigNumber => {
        const price = usdPricesMap.get(denom)
        if (!price || !price.gt(0)) return toBigNumber(0)

        const asset = assetsMap.get(denom)
        if (!asset) return toBigNumber(0)

        return price.multipliedBy(uAmountToBigNumberAmount(uAmount, asset.decimals))
    }

    return {
        totalUsdValue,
        denomUsdValue,
        isLoading,
    }
}
