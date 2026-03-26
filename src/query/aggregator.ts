import {MarketData} from "../types/market";
import {getAggregatorHost} from "../constants/endpoints";
import {HistoryOrder, SwapHistory} from "../types/aggregator";
import {TradeViewChart} from "../types/charts";

const getAllTickersUrl = (): string => {
    return `${getAggregatorHost()}/api/dex/tickers`;
}

const getHistoryUrl = (): string => {
    return `${getAggregatorHost()}/api/dex/history`;
}

export async function getAllTickers(): Promise<MarketData[]> {
    try {
        const resp = await fetch(getAllTickersUrl());
        if (resp.status !== 200) {
            console.error("failed to fetch tickers. status: ", resp.status);
            return [];
        }

        return await resp.json();
    } catch (e) {
        console.error("[AGG] failed to fetch tickers", e);
        return [];
    }
}

export async function getMarketOrdersHistory(marketId: string, limit: number = 1): Promise<HistoryOrder[]> {
    try {
        const url = `${getHistoryUrl()}?market_id=${marketId}&limit=${limit}`;
        const resp = await fetch(url);
        if (resp.status !== 200) {
            return [];
        }

        return await resp.json();
    } catch (e) {
        console.error("[AGG] failed to fetch market orders", e);
        return [];
    }
}

export async function getAddressHistory(address: string, market: string): Promise<HistoryOrder[]> {
    try {
        const url = `${getHistoryUrl()}?address=${address}&market_id=${market}&limit=100`;
        const resp = await fetch(url);
        if (resp.status !== 200) {
            return [];
        }

        return await resp.json();
    } catch (e) {
        console.error("failed to fetch address orders", e);
        return [];
    }
}

export async function getTradingViewIntervals(market: string, minutes: number, limit: number): Promise<TradeViewChart[]> {
    try {
        const url = `${getAggregatorHost()}/api/dex/intervals?market_id=${market}&minutes=${minutes}&limit=${limit}&format=tv`;
        const resp = await fetch(url);
        if (resp.status !== 200) {
            return [];
        }

        const jsonResponse = await resp.json();
        if (!jsonResponse) {
            return [];
        }

        return jsonResponse;
    } catch (e) {
        console.error("failed to fetch trading view intervals", e);
        return [];
    }
}

export async function getAddressSwapHistory(address: string): Promise<SwapHistory[]> {
    try {
        const url = `${getAggregatorHost()}/api/dex/swaps?address=${address}`;
        const resp = await fetch(url);
        if (resp.status !== 200) {
            console.error("failed to fetch swap history. status: ", resp.status);
            return [];
        }

        return await resp.json();
    } catch (e) {
        console.error("[AGG] failed to fetch swap history", e);
        return [];
    }
}
