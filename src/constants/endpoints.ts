
export function getRestURL(): string {
    return process.env.NEXT_PUBLIC_REST_URL || '';
}

export function getRpcURL(): string {
    return process.env.NEXT_PUBLIC_RPC_URL || '';
}

export function getArchwayRpcURL(): string {
    return process.env.NEXT_PUBLIC_RPC_URL_ARCHWAY || '';
}

export function getOsmosisRpcUrl(): string {
    return process.env.NEXT_PUBLIC_RPC_URL_OSMOSIS || '';
}

export function getNobleRpcUrl(): string {
    return process.env.NEXT_PUBLIC_RPC_URL_NOBLE || '';
}

export function getJackalRpcUrl(): string {
    return process.env.NEXT_PUBLIC_RPC_URL_JACKAL || '';
}

export function getOmniFlixRpcUrl(): string {
    return process.env.NEXT_PUBLIC_RPC_URL_FLIX || '';
}

export function getAtomOneRpcUrl(): string {
    return process.env.NEXT_PUBLIC_RPC_URL_ATOMONE || '';
}

export function getArchwayRestURL(): string {
    return process.env.NEXT_PUBLIC_REST_URL_ARCHWAY || '';
}

export function getOsmosisRestURL(): string {
    return process.env.NEXT_PUBLIC_REST_URL_OSMOSIS || '';
}

export function getNobleRestURL(): string {
    return process.env.NEXT_PUBLIC_REST_URL_NOBLE || '';
}

export function getJackalRestURL(): string {
    return process.env.NEXT_PUBLIC_REST_URL_JACKAL || '';
}

export function getOmniFlixRestURL(): string {
    return process.env.NEXT_PUBLIC_REST_URL_FLIX || '';
}

export function getAtomOneRestURL(): string {
    return process.env.NEXT_PUBLIC_REST_URL_ATOMONE || '';
}

export const getAggregatorHost = (): string => {
    return process.env.NEXT_PUBLIC_AGG_API_HOST ?? "https://getbze.com";
}

/**
 * Resolve a REST URL for an arbitrary chain name. Checks our per-chain env
 * vars first (NEXT_PUBLIC_REST_URL_*) and falls back to the chain-registry
 * `apis.rest[0]` address when no env override is configured. Returns an
 * empty string when neither source produces a usable URL.
 *
 * NOTE: This is a sync resolver used by cross-chain balance fetching. It does
 * not validate that the endpoint is reachable — the caller should handle
 * network errors and show a degraded UI.
 */
export function getChainRestURL(chainName: string): string {
    const envMap: Record<string, string | undefined> = {
        archway: process.env.NEXT_PUBLIC_REST_URL_ARCHWAY,
        osmosis: process.env.NEXT_PUBLIC_REST_URL_OSMOSIS,
        noble: process.env.NEXT_PUBLIC_REST_URL_NOBLE,
        jackal: process.env.NEXT_PUBLIC_REST_URL_JACKAL,
        omniflixhub: process.env.NEXT_PUBLIC_REST_URL_FLIX,
        atomone: process.env.NEXT_PUBLIC_REST_URL_ATOMONE,
    };
    const envValue = envMap[chainName];
    if (envValue) return envValue.replace(/\/$/, '');

    // Fallback: chain-registry. Imported lazily to keep this module free of
    // side effects in non-browser contexts.
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {chains: registryChains} = require('chain-registry') as { chains: Array<{ chain_name?: string; chainName?: string; apis?: { rest?: Array<{ address: string }> } }> };
        const chain = registryChains.find(c => (c.chainName || c.chain_name) === chainName);
        const rest = chain?.apis?.rest?.[0]?.address;
        if (rest) return rest.replace(/\/$/, '');
    } catch {
        // ignore
    }
    return '';
}
