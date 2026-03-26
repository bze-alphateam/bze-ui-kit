import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";
import {MAINNET_CHAIN_INFO_FALLBACK, TESTNET_CHAIN_INFO_FALLBACK} from "../constants/keplr";

async function getKeplrMainnetChainInfo() {
    const localKey = 'ci:keplr:mainnet';
    const cachedData = getFromLocalStorage(localKey);
    if (cachedData) {
        return JSON.parse(cachedData);
    }

    const url = 'https://raw.githubusercontent.com/faneaatiku/keplr-chain-registry/main/cosmos/beezee.json';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`HTTP error when fetching mainnet keplr data. status: ${response.status}`);
            return MAINNET_CHAIN_INFO_FALLBACK;
        }

        const json = await response.json();
        setInLocalStorage(localKey, JSON.stringify(json), 60 * 60 * 24);
        return json;
    } catch (error) {
        console.error(`Error fetching mainnet keplr data from ${url}:`, error);
        return MAINNET_CHAIN_INFO_FALLBACK;
    }
}

async function getKeplrTestnetChainInfo() {
    const localKey = 'ci:keplr:testnet';
    const cachedData = getFromLocalStorage(localKey);
    if (cachedData) {
        return JSON.parse(cachedData);
    }

    const url = 'https://raw.githubusercontent.com/faneaatiku/keplr-chain-registry/refs/heads/patch-2/cosmos/bzetestnet.json';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`HTTP error when fetching testnet keplr data. status: ${response.status}`);
            return TESTNET_CHAIN_INFO_FALLBACK;
        }

        const json = await response.json();
        setInLocalStorage(localKey, JSON.stringify(json), 60 * 60 * 24);
        return json;
    } catch (error) {
        console.error(`Error fetching testnet keplr data from ${url}:`, error);
        return TESTNET_CHAIN_INFO_FALLBACK;
    }
}

async function getKeplrChainInfo(chainId: string) {
    if (chainId !== 'beezee') {
        return getKeplrTestnetChainInfo();
    }

    return getKeplrMainnetChainInfo();
}

export async function keplrSuggestChain(chainId: string) {
    return await window.keplr?.experimentalSuggestChain(await getKeplrChainInfo(chainId))
}
