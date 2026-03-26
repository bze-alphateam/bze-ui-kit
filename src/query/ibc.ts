import {getSettings} from "../storage/settings";
import {CounterpartyChainForChannel, DenomTrace} from "../types/ibc";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";

const TRACES_CACHE_KEY = "ibc:traces";
const TRACES_CACHE_TTL = 5 * 60;
const HASH_TRACE_CACHE_TTL = 0;
const IBC_COUNTERPARTY_CACHE_TTL = 0;
const DEFAULT_LIMIT = 1000;

const getDenomTracesUrl = (limit: number): string => {
    const settings = getSettings()
    return `${settings.endpoints.restEndpoint}/ibc/apps/transfer/v1/denom_traces?pagination.limit=${limit}`;
}

const getHashDenomTracesUrl = (hash: string): string => {
    const settings = getSettings()
    return `${settings.endpoints.restEndpoint}/ibc/apps/transfer/v1/denom_traces/${hash}`;
}

export const getIBCTraces = async (): Promise<DenomTrace[]> => {
    const cached = getFromLocalStorage(TRACES_CACHE_KEY);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        const resp = await fetch(getDenomTracesUrl(DEFAULT_LIMIT));
        if (resp.status !== 200) {
            console.error("failed to fetch denom traces. status: ", resp.status);
            return [];
        }

        const responseJson = await resp.json();
        if (!responseJson.denom_traces) {
            return [];
        }

        setInLocalStorage(TRACES_CACHE_KEY, JSON.stringify(responseJson.denom_traces), TRACES_CACHE_TTL);

        return responseJson.denom_traces;
    } catch (e) {
        console.error("[IBC] failed to fetch denom traces", e);
        return [];
    }
}

const createHashTraceCacheKey = (hash: string): string => {
    return `${TRACES_CACHE_KEY}:${hash}`
}

export const getHashIBCTrace = async (hash: string): Promise<DenomTrace|undefined> => {
    const cacheKey = createHashTraceCacheKey(hash);
    const cached = getFromLocalStorage(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        const resp = await fetch(getHashDenomTracesUrl(hash));
        if (resp.status !== 200) {
            console.error("failed to fetch hash denom trace. status: ", resp.status);
            return;
        }

        const responseJson = await resp.json();
        if (!responseJson.denom_trace) {
            return;
        }

        setInLocalStorage(cacheKey, JSON.stringify(responseJson.denom_trace), HASH_TRACE_CACHE_TTL);

        return responseJson.denom_trace;
    } catch (e) {
        console.error("[IBC] failed to fetch denom traces", e);
    }

    return;
}

const getChannelIdUrl = (channelId: string, portId: string) => {
    const settings = getSettings()
    return `${settings.endpoints.restEndpoint}/ibc/core/channel/v1/channels/${channelId}/ports/${portId}`;
}

const getConnectionIdUrl = (connectionId: string) => {
    const settings = getSettings()
    return `${settings.endpoints.restEndpoint}/ibc/core/connection/v1/connections/${connectionId}`;
}

const getClientStateUrl = (clientId: string) => {
    const settings = getSettings()
    return `${settings.endpoints.restEndpoint}/ibc/core/client/v1/client_states/${clientId}`;
}

const getIbcCounterpartyChainIdCacheKey = (channelId: string, portId: string) => {
    return `ibc:counterparty:${channelId}:${portId}`;
}

export const counterpartyChainForChannel = async (channelId: string, portId: string = "transfer"): Promise<CounterpartyChainForChannel | undefined> => {
    const cacheKey = getIbcCounterpartyChainIdCacheKey(channelId, portId);
    const cached = getFromLocalStorage(cacheKey);
    if (cached) {
        return JSON.parse(cached) as CounterpartyChainForChannel;
    }

    const result: CounterpartyChainForChannel = {
        chainId: "",
        channelId: "",
    }

    try {
        const chRes = await fetch(getChannelIdUrl(channelId, portId));
        if (!chRes.ok) {
            console.error(`[counterpartyChainForChannel] channel fetch failed: ${chRes.status} ${chRes.statusText}`);
            return undefined;
        }

        const chJson = await chRes.json();
        const connectionId: string | undefined = chJson?.channel?.connection_hops?.[0];
        result.channelId = chJson?.channel?.counterparty?.channel_id;
        if (!connectionId || !result.channelId) {
            console.error(`[counterpartyChainForChannel] no connection_hops for ${channelId}/${portId}`);
            return undefined;
        }

        const connRes = await fetch(getConnectionIdUrl(connectionId));
        if (!connRes.ok) {
            console.error(`[counterpartyChainForChannel] connection fetch failed: ${connRes.status} ${connRes.statusText}`);
            return undefined;
        }
        const connJson = await connRes.json();
        const clientId: string | undefined = connJson?.connection?.client_id;
        if (!clientId) {
            console.error(`[counterpartyChainForChannel] no client_id on ${connectionId}`);
            return undefined;
        }

        const csRes = await fetch(getClientStateUrl(clientId));
        if (!csRes.ok) {
            console.error(`[counterpartyChainForChannel] client_state fetch failed: ${csRes.status} ${csRes.statusText}`);
            return undefined;
        }
        const csJson = await csRes.json();
        const clientState = csJson?.client_state?.value ?? csJson?.client_state;
        const chainId: string | undefined = clientState?.chain_id ?? clientState?.chainId;

        if (!chainId) {
            console.error(`[counterpartyChainForChannel] chain_id missing in client_state for ${clientId}`);
            return undefined;
        }

        result.chainId = chainId;

        setInLocalStorage(cacheKey, JSON.stringify(result), IBC_COUNTERPARTY_CACHE_TTL);

        return result;
    } catch (err) {
        console.error("[counterpartyChainForChannel] unexpected error:", err);
        return undefined;
    }
}
