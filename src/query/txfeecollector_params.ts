import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";

const CACHE_KEY = "txfeecollector_params";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface TxFeeCollectorParamsCache {
    validatorMinGasFee: {
        denom: string;
        amount: string;
    };
}

export const getTxFeeCollectorParams = async (): Promise<TxFeeCollectorParamsCache | undefined> => {
    const cached = getFromLocalStorage(CACHE_KEY);
    if (cached) {
        try {
            return JSON.parse(cached) as TxFeeCollectorParamsCache;
        } catch {
            // ignore parse error, refetch
        }
    }

    try {
        const client = await getRestClient();
        const response = await client.bze.txfeecollector.params();
        // The proto sets `(gogoproto.jsontag) = "validator_min_gas_fee"`, so the LCD JSON
        // uses snake_case — Telescope's PascalCase `ValidatorMinGasFee` typing does not
        // match the wire format. Read the snake_case key directly.
        const raw = (response?.params as unknown as {
            validator_min_gas_fee?: { denom?: string; amount?: string };
        } | undefined)?.validator_min_gas_fee;

        if (raw?.denom && raw?.amount) {
            const params: TxFeeCollectorParamsCache = {
                validatorMinGasFee: {
                    denom: raw.denom,
                    amount: raw.amount,
                },
            };
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_MS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch txfeecollector params:", e);
    }

    return undefined;
}
