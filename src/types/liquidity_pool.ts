import BigNumber from "bignumber.js";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";

export interface LiquidityPoolData {
    usdVolume: BigNumber;
    usdValue: BigNumber;
    usdFees: BigNumber;
    isComplete: boolean;
    apr: string;
    poolId: string;
    base: string;
    quote: string;
    baseVolume: BigNumber;
    quoteVolume: BigNumber;
}

export interface UserPoolData {
    userLiquidityUsd: BigNumber;
    userSharesPercentage: number;
}

export interface SwapRouteResult {
    route: string[];
    path: string[];
    pools: LiquidityPoolSDKType[];
    expectedOutput: BigNumber;
    priceImpact: BigNumber;
    totalFees: BigNumber;
    feesPerHop: BigNumber[];
}
