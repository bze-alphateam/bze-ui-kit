import BigNumber from "bignumber.js";
import { LiquidityPoolSDKType } from "@bze/bzejs/bze/tradebin/store";
import { toBigNumber } from "../utils/amount";
import {SwapRouteResult} from "../types/liquidity_pool";

interface RouteCache {
    result: SwapRouteResult;
    timestamp: number;
}

class AmmRouter {
    private static instance: AmmRouter;
    private routeCache = new Map<string, RouteCache>();
    private routeMap: Map<string, Map<string, LiquidityPoolSDKType>> = new Map();

    private constructor() {}

    static getInstance(): AmmRouter {
        if (!AmmRouter.instance) {
            AmmRouter.instance = new AmmRouter();
        }
        return AmmRouter.instance;
    }

    updatePools(pools: LiquidityPoolSDKType[]): void {
        this.routeMap = this.mapLiquidityPoolRoutes(pools);
        this.clearCache();
    }

    private mapLiquidityPoolRoutes(
        pools: LiquidityPoolSDKType[]
    ): Map<string, Map<string, LiquidityPoolSDKType>> {
        const routeMap = new Map<string, Map<string, LiquidityPoolSDKType>>();

        for (const pool of pools) {
            if (!routeMap.has(pool.base)) {
                routeMap.set(pool.base, new Map());
            }
            routeMap.get(pool.base)!.set(pool.quote, pool);

            if (!routeMap.has(pool.quote)) {
                routeMap.set(pool.quote, new Map());
            }
            routeMap.get(pool.quote)!.set(pool.base, pool);
        }

        return routeMap;
    }

    findOptimalRoute(
        fromDenom: string,
        toDenom: string,
        amountIn: BigNumber,
        maxHops: number,
        useCache: boolean = true
    ): SwapRouteResult | null {
        const cacheKey = this.getCacheKey(fromDenom, toDenom, maxHops);

        if (useCache) {
            const cached = this.routeCache.get(cacheKey);
            if (cached) {
                return {
                    ...cached.result,
                    ...this.calculateRouteOutput(cached.result.pools, cached.result.path, amountIn)
                };
            }
        }

        const result = this.findOptimalSwapRoute(fromDenom, toDenom, amountIn, maxHops);

        if (result) {
            this.routeCache.set(cacheKey, {
                result,
                timestamp: Date.now()
            });
        }

        return result;
    }

    calculateRouteOutput(
        pools: LiquidityPoolSDKType[],
        path: string[],
        amountIn: BigNumber
    ): Omit<SwapRouteResult, 'route' | 'path' | 'pools'> {
        let currentAmount = amountIn;
        const fees: BigNumber[] = [];

        for (let i = 0; i < pools.length; i++) {
            const pool = pools[i];
            const currentDenom = path[i];
            const isBaseToQuote = pool.base === currentDenom;

            const { amountOut, fee } = this.calculateSwapOutput(pool, currentAmount, isBaseToQuote);
            fees.push(fee);
            currentAmount = amountOut;
        }

        const expectedOutput = currentAmount;

        const theoretical = this.calculateTheoreticalOutputs(pools, path, amountIn);

        const totalFees = theoretical.withoutFees.minus(theoretical.withFees);
        const priceImpact = theoretical.withFees.isZero()
            ? toBigNumber(0)
            : theoretical.withFees.minus(expectedOutput).dividedBy(theoretical.withFees).multipliedBy(100);

        return {
            expectedOutput,
            priceImpact,
            totalFees,
            feesPerHop: fees
        };
    }

    clearCache(filter?: (key: string, cache: RouteCache) => boolean): void {
        if (!filter) {
            this.routeCache.clear();
            return;
        }

        for (const [key, cache] of this.routeCache.entries()) {
            if (filter(key, cache)) {
                this.routeCache.delete(key);
            }
        }
    }

    getCacheStats() {
        return {
            size: this.routeCache.size,
            keys: Array.from(this.routeCache.keys())
        };
    }

    private calculateTheoreticalOutputs(
        pools: LiquidityPoolSDKType[],
        path: string[],
        amountIn: BigNumber
    ): { withoutFees: BigNumber; withFees: BigNumber } {
        let theoreticalOutputNoFees = amountIn;
        let theoreticalOutputWithFees = amountIn;

        for (let i = 0; i < pools.length; i++) {
            const pool = pools[i];
            const currentDenom = path[i];
            const isBaseToQuote = pool.base === currentDenom;

            const reserveIn = toBigNumber(isBaseToQuote ? pool.reserve_base : pool.reserve_quote);
            const reserveOut = toBigNumber(isBaseToQuote ? pool.reserve_quote : pool.reserve_base);
            const midPrice = reserveOut.dividedBy(reserveIn);

            theoreticalOutputNoFees = theoreticalOutputNoFees.multipliedBy(midPrice);

            const fee = toBigNumber(pool.fee);
            theoreticalOutputWithFees = theoreticalOutputWithFees
                .multipliedBy(toBigNumber(1).minus(fee))
                .multipliedBy(midPrice);
        }

        return {
            withoutFees: theoreticalOutputNoFees,
            withFees: theoreticalOutputWithFees
        };
    }

    private calculateSwapOutput(
        pool: LiquidityPoolSDKType,
        amountIn: BigNumber,
        isBaseToQuote: boolean
    ): { amountOut: BigNumber; fee: BigNumber } {
        const fee = toBigNumber(pool.fee);
        const reserveIn = toBigNumber(isBaseToQuote ? pool.reserve_base : pool.reserve_quote);
        const reserveOut = toBigNumber(isBaseToQuote ? pool.reserve_quote : pool.reserve_base);

        const feeAmount = amountIn.multipliedBy(fee);
        const amountInAfterFee = amountIn.minus(feeAmount);

        const amountOut = amountInAfterFee
            .multipliedBy(reserveOut)
            .dividedBy(reserveIn.plus(amountInAfterFee));

        return { amountOut, fee: feeAmount };
    }

    private findOptimalSwapRoute(
        fromDenom: string,
        toDenom: string,
        amountIn: BigNumber,
        maxHops: number
    ): SwapRouteResult | null {
        if (fromDenom === toDenom) {
            return null;
        }

        interface RouteNode {
            denom: string;
            amount: BigNumber;
            path: string[];
            poolIds: string[];
            pools: LiquidityPoolSDKType[];
            fees: BigNumber[];
            hops: number;
        }

        const queue: RouteNode[] = [{
            denom: fromDenom,
            amount: amountIn,
            path: [fromDenom],
            poolIds: [],
            pools: [],
            fees: [],
            hops: 0
        }];

        const bestAmounts = new Map<string, BigNumber>();
        bestAmounts.set(fromDenom, amountIn);

        let bestRoute: RouteNode | null = null;

        while (queue.length > 0) {
            queue.sort((a, b) => b.amount.comparedTo(a.amount) ?? 0);
            const current = queue.shift()!;

            if (current.denom === toDenom) {
                if (!bestRoute || current.amount.isGreaterThan(bestRoute.amount)) {
                    bestRoute = current;
                }
                continue;
            }

            if (current.hops >= maxHops) {
                continue;
            }

            const neighbors = this.routeMap.get(current.denom);
            if (!neighbors) continue;

            for (const [nextDenom, pool] of neighbors.entries()) {
                if (current.path.includes(nextDenom)) {
                    continue;
                }

                const isBaseToQuote = pool.base === current.denom;

                const { amountOut, fee } = this.calculateSwapOutput(pool, current.amount, isBaseToQuote);

                if (amountOut.lte(0)) {
                    continue;
                }

                const previousBest = bestAmounts.get(nextDenom);
                if (previousBest && amountOut.lte(previousBest)) {
                    continue;
                }

                bestAmounts.set(nextDenom, amountOut);

                queue.push({
                    denom: nextDenom,
                    amount: amountOut,
                    path: [...current.path, nextDenom],
                    poolIds: [...current.poolIds, pool.id],
                    pools: [...current.pools, pool],
                    fees: [...current.fees, fee],
                    hops: current.hops + 1
                });
            }
        }

        if (!bestRoute) {
            return null;
        }

        const theoretical = this.calculateTheoreticalOutputs(bestRoute.pools, bestRoute.path, amountIn);

        const totalFees = theoretical.withoutFees.minus(theoretical.withFees);
        const priceImpact = theoretical.withFees.isZero()
            ? toBigNumber(0)
            : theoretical.withFees.minus(bestRoute.amount).dividedBy(theoretical.withFees).multipliedBy(100);

        return {
            route: bestRoute.poolIds,
            path: bestRoute.path,
            pools: bestRoute.pools,
            expectedOutput: bestRoute.amount,
            priceImpact,
            totalFees,
            feesPerHop: bestRoute.fees
        };
    }

    private getCacheKey(fromDenom: string, toDenom: string, maxHops: number): string {
        return `${fromDenom}_${toDenom}_${maxHops}`;
    }
}

export const ammRouter = AmmRouter.getInstance();
