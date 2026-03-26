import {getPageRequestWithLimit, getRestClient} from "./client";
import {
    QueryAllMarketsRequest,
    QueryMarketAggregatedOrdersRequest,
    QueryMarketAggregatedOrdersResponseSDKType,
    QueryMarketHistoryRequest,
    QueryMarketHistoryResponseSDKType,
    QueryMarketOrderRequest,
    QueryMarketOrderResponseSDKType,
    QueryUserMarketOrdersRequest,
    QueryUserMarketOrdersResponseSDKType,
} from "@bze/bzejs/bze/tradebin/query";
import {ORDER_TYPE_BUY, ORDER_TYPE_SELL} from "../types/market";
import {PageRequest} from "@bze/bzejs/cosmos/base/query/v1beta1/pagination";
import {OrderSDKType} from "@bze/bzejs/bze/tradebin/store";

const {fromPartial: AllMarketsRequest} = QueryAllMarketsRequest;
const {fromPartial: QueryMarketAggregatedOrdersRequestFromPartyal} = QueryMarketAggregatedOrdersRequest;
const {fromPartial: QueryMarketHistoryRequestFromPartial} = QueryMarketHistoryRequest;
const {fromPartial: QueryUserMarketOrdersRequestFromPartial} = QueryUserMarketOrdersRequest;
const {fromPartial: QueryMarketOrderRequestFromPartial} = QueryMarketOrderRequest;

const DEFAULT_LIMIT = 1000;

export const getMarkets = async () => {
    try {
        const client = await getRestClient();
        const resp = await client.bze.tradebin.allMarkets(AllMarketsRequest(
            {pagination: getPageRequestWithLimit(DEFAULT_LIMIT)})
        );

        return resp.market;
    } catch (error) {
        console.error('failed to get markets: ', error);
    }

    return []
}

export async function getMarketBuyOrders(marketId: string): Promise<QueryMarketAggregatedOrdersResponseSDKType> {
    return getMarketOrders(marketId, ORDER_TYPE_BUY);
}

export async function getMarketSellOrders(marketId: string): Promise<QueryMarketAggregatedOrdersResponseSDKType> {
    return getMarketOrders(marketId, ORDER_TYPE_SELL);
}

export async function getMarketOrders(marketId: string, orderType: string): Promise<QueryMarketAggregatedOrdersResponseSDKType> {
    try {
        const reversed = orderType === ORDER_TYPE_BUY;
        const client = await getRestClient();
        return client.bze.tradebin.marketAggregatedOrders(QueryMarketAggregatedOrdersRequestFromPartyal({
            market: marketId,
            orderType: orderType,
            pagination: PageRequest.fromPartial({limit: BigInt(15), reverse: reversed})
        }));
    } catch (e) {
        console.error(e);
        return {list: []};
    }
}

export async function getMarketHistory(marketId: string): Promise<QueryMarketHistoryResponseSDKType> {
    try {
        const client = await getRestClient();
        return client.bze.tradebin.marketHistory(QueryMarketHistoryRequestFromPartial({
            market: marketId,
            pagination: PageRequest.fromPartial({limit: BigInt(50), reverse: true})
        }));
    } catch (e) {
        console.error(e);
        return {list: []};
    }
}

export async function getAddressMarketOrders(marketId: string, address: string): Promise<QueryUserMarketOrdersResponseSDKType> {
    try {
        const client = await getRestClient();
        return client.bze.tradebin.userMarketOrders(QueryUserMarketOrdersRequestFromPartial({
            market: marketId,
            address: address,
            pagination: PageRequest.fromPartial({limit: BigInt(100), reverse: true})
        }));
    } catch (e) {
        console.error(e);
        return {list: []};
    }
}

export async function getAddressFullMarketOrders(marketId: string, address: string): Promise<OrderSDKType[]> {
    const addressOrders = await getAddressMarketOrders(marketId, address);
    if (addressOrders.list.length === 0) {
        return [];
    }

    const promises = [];
    for (const reference of addressOrders.list) {
        promises.push(getMarketOrder(reference.market_id, reference.order_type, reference.id))
    }

    const orders = await Promise.all(promises);

    return orders.filter((item) => item !== undefined).map(resp => resp.order) as OrderSDKType[];
}

export async function getMarketOrder(marketId: string, orderType: string, orderId: string): Promise<QueryMarketOrderResponseSDKType|undefined> {
    try {
        const client = await getRestClient();
        return client.bze.tradebin.marketOrder(QueryMarketOrderRequestFromPartial({
            market: marketId,
            orderType: orderType,
            orderId: orderId
        }));
    } catch (e) {
        console.error(e);
        return undefined;
    }
}
