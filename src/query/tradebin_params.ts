import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";

const CACHE_KEY = "tradebin_params";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface TradebinParamsCache {
    minNativeLiquidityForModuleSwap: string;
}

export const getTradebinParams = async (): Promise<TradebinParamsCache | undefined> => {
    // Check local cache first
    const cached = getFromLocalStorage(CACHE_KEY);
    if (cached) {
        try {
            return JSON.parse(cached) as TradebinParamsCache;
        } catch {
            // ignore parse error, refetch
        }
    }

    try {
        const client = await getRestClient();
        const response = await client.bze.tradebin.params();
        if (response.params) {
            const params: TradebinParamsCache = {
                minNativeLiquidityForModuleSwap: response.params.minNativeLiquidityForModuleSwap,
            };
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_MS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch tradebin params:", e);
    }

    return undefined;
}
