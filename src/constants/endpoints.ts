
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
