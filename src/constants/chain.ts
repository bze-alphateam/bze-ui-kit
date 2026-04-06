
import { chains as testnetChains } from "chain-registry/testnet";
import {getAssetLists as ibcAssetsList} from "@chain-registry/utils";
import {BZE_TESTNET_2_SUGGEST_CHAIN, BZE_TESTNET_NETWORK} from "./testnet";
import {Chain} from "@chain-registry/types";
import {assetLists, chains, ibcData} from "chain-registry";
import {isChainDenied, isCrossChainEnabled} from "./cross_chain";

export const getChainId = (): string => {
    return process.env.NEXT_PUBLIC_CHAIN_ID || 'beezee-1'
}

export const getChainName = (): string => {
    return process.env.NEXT_PUBLIC_CHAIN_NAME || 'beezee'
}

export const isTestnetChain = (): boolean => {
    const isTestnet = process.env.NEXT_PUBLIC_CHAIN_IS_TESTNET
    return isTestnet === 'true' || isTestnet === '1'
}

export const getChains = () => {
    let localChains = chains
    if (isTestnetChain()) {
        //@ts-expect-error - testnet chains are not in the chain-registry package
        localChains = [...testnetChains, BZE_TESTNET_2_SUGGEST_CHAIN]
    }

    return localChains
}

export const getChainByChainId = (chainId: string) => {
    let localChains = chains
    if (isTestnetChain()) {
        //@ts-expect-error - testnet chains are not in the chain-registry package
        localChains = [...testnetChains, BZE_TESTNET_2_SUGGEST_CHAIN]
    }

    return localChains.find(c => c.chainId?.toLowerCase() === chainId.toLowerCase())
}

export const getChainByName = (name: string) => {
    let localChains = chains
    if (isTestnetChain()) {
        //@ts-expect-error - testnet chains are not in the chain-registry package
        localChains = [...testnetChains, BZE_TESTNET_2_SUGGEST_CHAIN]
    }

    return localChains.find(c => c.chainName.toLowerCase() === name.toLowerCase())
}

/**
 * Walk chain-registry's ibcData to collect every Cosmos chain BZE has an IBC
 * channel with. This is the dynamic substitute for the old hardcoded bridge
 * allowlist — any IBC connection published in chain-registry makes its
 * counterparty chain pre-registerable with Keplr.
 */
const getBzeIbcCounterparties = (): string[] => {
    const bzeName = getChainName()
    const names = new Set<string>()
    try {
        // chain-registry npm exposes IBC entries in camelCase: chain1.chainName
        // and chain2.chainName. (The snake_case form belongs to the raw JSON in
        // the GitHub repo, not the typed npm package.)
        for (const entry of ibcData as unknown as Array<{
            chain1?: { chainName?: string };
            chain2?: { chainName?: string };
        }>) {
            const a = entry.chain1?.chainName
            const b = entry.chain2?.chainName
            if (!a || !b) continue
            if (a === bzeName) names.add(b)
            else if (b === bzeName) names.add(a)
        }
    } catch {
        // ibcData shape drift — fail quiet, bridge degrades to env-only chains.
    }
    return Array.from(names)
}

export const getWalletChainsNames = () => {
    const localChains = getChains()

    const envChainsNames = process.env.NEXT_PUBLIC_WALLET_CHAINS_NAMES
    const envNames = envChainsNames ? envChainsNames.split(',') : []

    // Always include the BZE chain plus any chains explicitly listed in env.
    const baseNames = new Set<string>(envNames)
    baseNames.add(getChainName())

    // When the cross-chain bridge is enabled, auto-register every chain BZE
    // has an IBC channel with (per chain-registry). That way `useChain(chain)`
    // can connect any of them at runtime without a redeploy when a new IBC
    // connection is added on the BZE side.
    if (isCrossChainEnabled()) {
        for (const name of getBzeIbcCounterparties()) {
            if (isChainDenied(name)) continue
            baseNames.add(name)
        }
    }

    return appChainFirst(localChains.filter(c => baseNames.has(c.chainName)))
}

const appChainFirst = (chains: Chain[]) => {
    return chains.sort((a, b) => a.chainId === getChainId() ? -1 : b.chainId === getChainId() ? 1 : 0)
}

export const getAssetLists = () => {
    let localAssetLists = assetLists
    if (isTestnetChain()) {
        //@ts-expect-error - testnet asset lists are not in the chain-registry package
        localAssetLists = BZE_TESTNET_NETWORK.assets
    }

    return localAssetLists
}

export const getIBCAssetList = () => {
    const all = ibcAssetsList(getChainName(), ibcData, getAssetLists())

    return all.length > 0 ? all[0].assets : []
}

export const getChainAddressPrefix = () => {
    return process.env.NEXT_PUBLIC_CHAIN_ADDRESS_PREFIX || 'bze'
}

export const getChainExplorerURL = (chainName: string): string => {
    if (process.env.NEXT_PUBLIC_EXPLORER_URL) {
        return `${process.env.NEXT_PUBLIC_EXPLORER_URL}/${chainName}`
    }

    return `https://explorer.chaintools.tech/${chainName}`
}

export const getLockerAddress = (): string => {
    return process.env.NEXT_PUBLIC_LOCKER_ADDRESS || 'bze1pc5zjcvhx3e8l305zjl72grytfa30r5mdypmw4'
}

export const getGasMultiplier = (): number => {
    const val = parseFloat(process.env.NEXT_PUBLIC_GAS_MULTIPLIER || '');
    return isNaN(val) || val <= 0 ? 1.5 : val;
}

export const getGasPrice = (): number => {
    const val = parseFloat(process.env.NEXT_PUBLIC_GAS_PRICE || '');
    return isNaN(val) || val <= 0 ? 0.02 : val;
}

export const getNonNativeGasMultiplier = (): number => {
    const val = parseFloat(process.env.NEXT_PUBLIC_NON_NATIVE_GAS_MULTIPLIER || '');
    return isNaN(val) || val <= 0 ? 1.5 : val;
}
