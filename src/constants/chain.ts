
import { chains as testnetChains } from "chain-registry/testnet";
import {getAssetLists as ibcAssetsList} from "@chain-registry/utils";
import {BZE_TESTNET_2_SUGGEST_CHAIN, BZE_TESTNET_NETWORK} from "./testnet";
import {Chain} from "@chain-registry/types";
import {assetLists, chains, ibcData} from "chain-registry";

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

export const getWalletChainsNames = () => {
    const localChains = getChains()

    const envChainsNames = process.env.NEXT_PUBLIC_WALLET_CHAINS_NAMES
    if (!envChainsNames) {
        return localChains.filter(c => c.chainId === getChainId())
    }

    const split = envChainsNames.split(',')

    return appChainFirst(localChains.filter(c => split.includes(c.chainName)))
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
