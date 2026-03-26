import {AggregatedOrderSDKType, MarketSDKType} from "@bze/bzejs/bze/tradebin/store";

export const ORDER_TYPE_BUY = 'buy';
export const ORDER_TYPE_SELL = 'sell';

export type Market = MarketSDKType

export interface MarketData {
    base: string;
    quote: string;
    market_id: string;
    last_price: number;
    base_volume: number;
    quote_volume: number;
    bid: number;
    ask: number;
    high: number;
    low: number;
    open_price: number;
    change: number;
}

export interface ActiveOrders {
    buyOrders: AggregatedOrderSDKType[];
    sellOrders: AggregatedOrderSDKType[];
}
