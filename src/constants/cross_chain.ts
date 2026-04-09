/**
 * Cross-chain bridge configuration.
 *
 * As of the dynamic-assets migration the bridge no longer maintains a
 * hardcoded list of supported chains and assets. Instead, the network and
 * asset pickers are derived at runtime from the user's BZE asset list — any
 * asset with a complete IBCData trace becomes bridgeable automatically.
 *
 * This file keeps only the small amount of config that can't be inferred:
 *   • feature flag
 *   • Skip proxy URL (used in a later phase)
 *   • BZE's own Skip chain ID
 *   • an optional denylist so operators can hide specific chains/assets
 *     even when the registry exposes them (broken channel, deprecated asset,
 *     etc.) — empty by default.
 */

export const BZE_SKIP_CHAIN_ID = 'beezee-1';
export const BZE_NATIVE_DENOM = 'ubze';

// ─── Feature flag ───────────────────────────────────────────────────────

/**
 * Whether IBC deposit/withdraw is enabled. This is chain-native (no Skip)
 * and works on both mainnet and testnet — the asset list is derived from
 * whatever assets the chain has, so testnet only shows testnet IBC assets.
 * Default: true. Override with `NEXT_PUBLIC_CROSS_CHAIN_ENABLED=false`.
 */
export const isCrossChainEnabled = (): boolean => {
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CROSS_CHAIN_ENABLED !== undefined) {
        return process.env.NEXT_PUBLIC_CROSS_CHAIN_ENABLED !== 'false';
    }
    return true;
};

/**
 * Whether Skip-powered features (Buy BZE, swap routes) are available.
 * Always false on testnet — Skip has no BZE testnet chain ID (bzetestnet-3).
 * On mainnet, follows `isCrossChainEnabled()`.
 */
export const isSkipEnabled = (): boolean => {
    // Read the env var directly to avoid a circular import with chain.ts.
    // NOTE: must use `process.env.X` (not `process.env?.X`) so that Next.js
    // recognises the pattern and inlines the value at build time.  Optional
    // chaining compiles (via tsup) to a temp variable that Next.js won't match.
    const isTestnet = process.env.NEXT_PUBLIC_CHAIN_IS_TESTNET;
    if (isTestnet === 'true' || isTestnet === '1') return false;

    return isCrossChainEnabled();
};

// ─── Skip proxy URL (Phase 2) ───────────────────────────────────────────

/** URL for the Skip API proxy in the consuming app */
const DEFAULT_SKIP_PROXY_URL = '/api/skip';

export const getSkipProxyUrl = (): string => {
    return typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SKIP_PROXY_URL
        ? process.env.NEXT_PUBLIC_SKIP_PROXY_URL
        : DEFAULT_SKIP_PROXY_URL;
};

// ─── Denylist ───────────────────────────────────────────────────────────
// Kill switch for individual chains or assets. Values come from env vars
// (comma-separated, lowercased) so ops can flip them without a rebuild.
//
//   NEXT_PUBLIC_BRIDGE_DENY_CHAINS="somechain,anotherchain"
//   NEXT_PUBLIC_BRIDGE_DENY_ASSETS="ibc/ABCDEF...,factory/..."
//
// Anything listed here is excluded from the bridge picker even if it is
// otherwise bridgeable. Empty by default.

const parseCsvEnv = (value: string | undefined): Set<string> => {
    if (!value) return new Set();
    return new Set(
        value
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean),
    );
};

export const getDeniedChains = (): Set<string> =>
    parseCsvEnv(process.env?.NEXT_PUBLIC_BRIDGE_DENY_CHAINS);

export const getDeniedAssets = (): Set<string> =>
    parseCsvEnv(process.env?.NEXT_PUBLIC_BRIDGE_DENY_ASSETS);

export const isChainDenied = (chainName: string): boolean =>
    getDeniedChains().has(chainName.toLowerCase());

export const isAssetDenied = (denom: string): boolean =>
    getDeniedAssets().has(denom.toLowerCase());
