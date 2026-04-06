'use client'

import {useMemo} from "react";
import type {Asset, IBCData} from "../types/asset";
import {useAssetsContext} from "./useAssets";
import {isAssetDenied, isChainDenied} from "../constants/cross_chain";
import {isIbcDenom} from "../utils/denom";
import {getChains} from "../constants/chain";

/**
 * A single asset that can be bridged between BZE and a Cosmos counterparty
 * chain via pure IBC. Built from the user's already-hydrated `Asset` plus
 * the chain-registry metadata for the counterparty chain.
 *
 * Everything the bridge form, balance lookup, and MsgTransfer builder need
 * lives on this one object.
 */
export interface BridgeableAsset {
    /** The full Asset record from BZE's assets map (has the voucher denom, ticker, logo, decimals, etc). */
    bzeAsset: Asset;
    /** Resolved IBC trace — guaranteed to have both sides populated. */
    ibcData: IBCData;
    /** Counterparty chain metadata pulled from chain-registry (pretty name, logo, bech32 prefix). */
    counterparty: {
        chainName: string;
        chainId: string;
        displayName: string;
        logo: string;
        addressPrefix: string;
    };
}

/** A group of bridgeable assets that all sit on the same counterparty chain. */
export interface BridgeableChain {
    chainName: string;
    chainId: string;
    displayName: string;
    logo: string;
    addressPrefix: string;
    assets: BridgeableAsset[];
}

// ─── chain-registry lookup helpers ────────────────────────────────────────
// chain-registry npm exposes camelCase fields. We go through `getChains()`
// (from constants/chain) rather than importing the package directly because
// it also handles testnet mode by merging in the testnet registry.

type RegistryChain = {
    chainName?: string;
    prettyName?: string;
    chainId?: string;
    bech32Prefix?: string;
    logoURIs?: { png?: string; svg?: string };
    apis?: { rest?: Array<{ address: string }> };
};

const registryChainFor = (chainName: string): RegistryChain | undefined => {
    const norm = chainName.toLowerCase();
    const all = getChains() as unknown as RegistryChain[];
    return all.find(c => (c.chainName || '').toLowerCase() === norm);
};

const pickLogo = (c: RegistryChain | undefined): string => {
    const logos = c?.logoURIs;
    return logos?.svg || logos?.png || '';
};

// ─── Completeness check ───────────────────────────────────────────────────

/** Every field we need to build a MsgTransfer against this asset. */
const isBridgeable = (asset: Asset): boolean => {
    // Use the existing denom-based check rather than asset.type, which uses
    // capitalized ASSET_TYPE_* constants and is easy to mis-compare. Any voucher
    // with an `ibc/...` denom qualifies as long as the trace is complete.
    if (!asset.denom || !isIbcDenom(asset.denom)) return false;
    if (!asset.IBCData) return false;
    if (!asset.IBCData.chain?.channelId) return false;
    if (!asset.IBCData.counterparty?.channelId) return false;
    if (!asset.IBCData.counterparty?.chainName) return false;
    if (!asset.IBCData.counterparty?.baseDenom) return false;
    if (!asset.decimals || asset.decimals <= 0) return false;
    return true;
};

// ─── Public hook ──────────────────────────────────────────────────────────

export interface UseBridgeableAssetsResult {
    assets: BridgeableAsset[];
    chains: BridgeableChain[];
    isLoading: boolean;
}

/**
 * Derives bridgeable assets straight from the user's BZE asset list. An asset
 * appears here if:
 *   1. It's an IBC voucher with a complete trace (both sides, base denom,
 *      decimals, etc).
 *   2. Its counterparty chain is present in chain-registry (so we have a
 *      chainId / prefix / display metadata to pass to Keplr).
 *   3. Neither the chain nor the asset is in the env denylist.
 *
 * Grouped by counterparty chain so the bridge form can render a network
 * picker and per-chain asset picker without any hardcoded config.
 */
export function useBridgeableAssets(): UseBridgeableAssetsResult {
    const {assetsMap, isLoading} = useAssetsContext();

    const {assets, chains} = useMemo(() => {
        const allAssets: BridgeableAsset[] = [];
        const byChain = new Map<string, BridgeableChain>();

        for (const asset of assetsMap.values()) {
            if (!isBridgeable(asset)) continue;
            if (isAssetDenied(asset.denom)) continue;

            const cpName = asset.IBCData!.counterparty.chainName;
            if (isChainDenied(cpName)) continue;

            const registryChain = registryChainFor(cpName);
            if (!registryChain) continue;

            const chainId = registryChain.chainId || '';
            const displayName =
                registryChain.prettyName ||
                asset.IBCData!.counterparty.chainPrettyName ||
                cpName;
            const addressPrefix = registryChain.bech32Prefix || '';
            const logo = pickLogo(registryChain);

            if (!chainId || !addressPrefix) continue;

            const bridgeable: BridgeableAsset = {
                bzeAsset: asset,
                ibcData: asset.IBCData!,
                counterparty: {
                    chainName: cpName,
                    chainId,
                    displayName,
                    logo,
                    addressPrefix,
                },
            };

            allAssets.push(bridgeable);

            const existing = byChain.get(cpName);
            if (existing) {
                existing.assets.push(bridgeable);
            } else {
                byChain.set(cpName, {
                    chainName: cpName,
                    chainId,
                    displayName,
                    logo,
                    addressPrefix,
                    assets: [bridgeable],
                });
            }
        }

        // Stable, deterministic order: chains by displayName, assets by ticker.
        const sortedChains = Array.from(byChain.values()).sort((a, b) =>
            a.displayName.localeCompare(b.displayName),
        );
        for (const c of sortedChains) {
            c.assets.sort((a, b) => (a.bzeAsset.ticker || '').localeCompare(b.bzeAsset.ticker || ''));
        }

        return {assets: allAssets, chains: sortedChains};
    }, [assetsMap]);

    return {assets, chains, isLoading};
}
