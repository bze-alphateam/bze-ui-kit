import {getChains} from "./chain";
import {resolveHealthyRestUrl} from "../utils/endpoint_health";

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
 * Return the env-configured REST URL for a chain (if any). Env-provided URLs
 * are trusted — they skip the health-check path because if the operator sets
 * one explicitly, they want a loud failure rather than a silent fallback to
 * chain-registry when their endpoint hiccups.
 */
export function getEnvRestURL(chainName: string): string {
    const envMap: Record<string, string | undefined> = {
        archway: process.env.NEXT_PUBLIC_REST_URL_ARCHWAY,
        osmosis: process.env.NEXT_PUBLIC_REST_URL_OSMOSIS,
        noble: process.env.NEXT_PUBLIC_REST_URL_NOBLE,
        jackal: process.env.NEXT_PUBLIC_REST_URL_JACKAL,
        omniflixhub: process.env.NEXT_PUBLIC_REST_URL_FLIX,
        atomone: process.env.NEXT_PUBLIC_REST_URL_ATOMONE,
    };
    const value = envMap[chainName];
    return value ? value.replace(/\/$/, '') : '';
}

/**
 * Collect every REST URL chain-registry publishes for a chain, in the order
 * the registry lists them. Uses the same `getChains()` helper that already
 * handles testnet mode — going through `require('chain-registry')` directly
 * is unreliable in the tsup-built browser bundle.
 */
export function getRegistryRestURLs(chainName: string): string[] {
    const all = getChains() as unknown as Array<{
        chainName?: string;
        apis?: { rest?: Array<{ address: string }> };
    }>;
    const chain = all.find(c => (c.chainName || '').toLowerCase() === chainName.toLowerCase());
    const rest = chain?.apis?.rest ?? [];
    return rest.map(r => r.address).filter(Boolean);
}

/**
 * Resolve a healthy REST URL for an arbitrary chain name. Order:
 *   1. `NEXT_PUBLIC_REST_URL_<CHAIN>` (trusted, no health check)
 *   2. `chain-registry`'s `apis.rest[]`, first one that passes a live probe
 *      (see `resolveHealthyRestUrl`, 2.5s timeout, sequential fallback)
 * Returns an empty string when neither source produces a reachable URL — the
 * caller should surface a "we can't reach X" hint and still allow the tx.
 *
 * NOTE: async. `useCounterpartyBalance` awaits this before calling /balances.
 */
export async function getChainRestURL(chainName: string): Promise<string> {
    const envUrl = getEnvRestURL(chainName);
    if (envUrl) return envUrl;
    return resolveHealthyRestUrl(chainName, getRegistryRestURLs(chainName));
}
