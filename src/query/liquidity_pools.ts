import {getPageRequestWithLimit, getRestClient} from "./client";
import {QueryAllLiquidityPoolsRequest, QueryLiquidityPoolRequest} from "@bze/bzejs/bze/tradebin/query";

const {fromPartial: AllLpsRequest} = QueryAllLiquidityPoolsRequest;
const {fromPartial: LpRequest} = QueryLiquidityPoolRequest;

const DEFAULT_LIMIT = 1000;

export const getLiquidityPools = async () => {
    try {
        const client = await getRestClient();
        const resp = await client.bze.tradebin.allLiquidityPools(AllLpsRequest(
            {pagination: getPageRequestWithLimit(DEFAULT_LIMIT)})
        );

        return resp.list;
    } catch (error) {
        console.error('failed to get markets: ', error);
    }

    return []
}

export const getLiquidityPool = async (poolId: string) => {
    try {
        const client = await getRestClient();
        const resp = await client.bze.tradebin.liquidityPool(LpRequest({
            poolId: poolId,
        }));

        return resp.pool;
    } catch (error) {
        console.error('failed to get markets: ', error);
    }

    return undefined
}
