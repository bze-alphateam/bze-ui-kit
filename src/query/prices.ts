import {getAggregatorHost} from "../constants/endpoints";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";
import {PriceApiResponse} from "../types/price";

const PRICE_PATH = '/api/prices';

const usdPriceDenom = "usd";
const usdPriceCacheKey = "price:usd";
const priceCacheTtl = 5 * 60;

const getPriceUrl = (): string => {
    return `${getAggregatorHost()}${PRICE_PATH}`;
}

const getAssetPriceCacheKey = (asset: string): string => {
    return `${usdPriceCacheKey}:${asset.toLowerCase()};`
}

const fetchAssetUsdPrice = async (asset: string): Promise<PriceApiResponse | undefined> => {
    const cacheKey = getAssetPriceCacheKey(asset);
    const cached = getFromLocalStorage(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        const resp = await fetch(getPriceUrl());
        if (resp.status !== 200) {
            return undefined
        }

        const decodedResp = await resp.json();
        const result = decodedResp.find((item: PriceApiResponse) => item.denom.toLowerCase() === asset.toLowerCase() && item.price_denom.toLowerCase() === usdPriceDenom);

        setInLocalStorage(cacheKey, JSON.stringify(result), priceCacheTtl);

        return result;
    } catch (e) {
        console.log("error on getAssetUsdPrice: ", e);
        return undefined;
    }
}

export const getBZEUSDPrice = async (): Promise<number> => {
    const usdPrice = await fetchAssetUsdPrice("bzedge");
    if (!usdPrice) {
        return 0;
    }

    return usdPrice.price;
}
