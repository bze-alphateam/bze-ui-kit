import {Balance} from "../types/balance";
import {Asset} from "../types/asset";
import {LiquidityPoolData, UserPoolData} from "../types/liquidity_pool";
import {toBigNumber} from "./amount";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import BigNumber from "bignumber.js";

export const calculateUserPoolData = (
    balance: Balance | undefined,
    lpAsset: Asset | undefined,
    poolData: LiquidityPoolData | undefined
): UserPoolData => {
    const zeroBN = toBigNumber(0)
    if (!balance || balance.amount.isZero()) {
        return { userLiquidityUsd: zeroBN, userSharesPercentage: 0 }
    }

    if (!lpAsset) {
        return { userLiquidityUsd: zeroBN, userSharesPercentage: 0 }
    }

    const userShares = toBigNumber(balance.amount)
    const totalShares = toBigNumber(lpAsset.supply)

    if (totalShares.isZero()) {
        return { userLiquidityUsd: zeroBN, userSharesPercentage: 0 }
    }

    const userSharesPercentage = userShares.dividedBy(totalShares).multipliedBy(100).toNumber()

    let userLiquidityUsd = zeroBN
    if (poolData && poolData.usdValue) {
        userLiquidityUsd = userShares.dividedBy(totalShares).multipliedBy(poolData.usdValue)
    }

    return { userLiquidityUsd, userSharesPercentage }
}

export const calculatePoolOppositeAmount = (pool: LiquidityPoolSDKType, amount: string | BigNumber, isBase: boolean): BigNumber => {
    const amountBN = toBigNumber(amount);
    if (amountBN.isZero() || amountBN.isNaN()) {
        return toBigNumber(0);
    }

    const reserveBase = toBigNumber(pool.reserve_base);
    const reserveQuote = toBigNumber(pool.reserve_quote);

    if (reserveBase.isZero() || reserveQuote.isZero()) {
        return toBigNumber(0);
    }

    if (isBase) {
        return amountBN.multipliedBy(reserveQuote).dividedBy(reserveBase);
    } else {
        return amountBN.multipliedBy(reserveBase).dividedBy(reserveQuote);
    }
}

export const calculatePoolPrice = (
    denom: string,
    pool: LiquidityPoolSDKType
): BigNumber | null => {
    if (!pool || !denom) return null;

    const reserveBase = toBigNumber(pool.reserve_base);
    const reserveQuote = toBigNumber(pool.reserve_quote);

    if (reserveBase.lte(0) || reserveQuote.lte(0)) {
        return null;
    }

    if (denom === pool.base) {
        return reserveQuote.dividedBy(reserveBase);
    }

    if (denom === pool.quote) {
        return reserveBase.dividedBy(reserveQuote);
    }

    return null;
}

export const createPoolId = (base: string, quote: string) => {
    if (base > quote) return (
        `${quote}_${base}`
    )

    return `${base}_${quote}`
};

export const poolIdFromPoolDenom = (poolDenom: string) => poolDenom.replace("ulp_", '');
