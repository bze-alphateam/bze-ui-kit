import {getAllSupply, getAllSupplyMetadata} from "../query/supply";
import {MetadataSDKType} from "@bze/bzejs/cosmos/bank/v1beta1/bank";
import {Asset, ChainAssets, IBCData, IbcTransitionMock, LP_ASSETS_DECIMALS} from "../types/asset";
import {getDenomType, isFactoryDenom, isIbcDenom, isLpDenom, isNativeDenom, truncateDenom} from "../utils/denom";
import {BZE_CIRCLE_LOGO, TOKEN_LOGO_PLACEHOLDER} from "../constants/placeholders";
import {EXCLUDED_ASSETS, STABLE_COINS, VERIFIED_ASSETS} from "../constants/assets";
import {
    getAssetLists, getChainByChainId,
    getChainName,
    getChains,
    getIBCAssetList
} from "../constants/chain";
import {getExponentByDenomFromAsset} from "@chain-registry/utils";
import {counterpartyChainForChannel, getHashIBCTrace} from "../query/ibc";
import {Asset as ChainRegistryAsset} from "@chain-registry/v2-types";
import {denomOnFirstHopChainFromTrace} from "../utils/ibc";

const ORIGIN_CHAIN_PLACEHOLDER = "Unknown chain"

export const getChainAssets = async (): Promise<ChainAssets> => {
    const [metadata, supply] = await Promise.all([getAllMetadataMap(), getAllSupply()])
    const result = {
        assets: new Map<string, Asset>(),
        ibcData: new Map<string, IBCData>()
    }

    if (!metadata || !supply) {
        return result;
    }

    const filtered = supply.filter(asset => !EXCLUDED_ASSETS[asset.denom])
    const lpAssets = []
    for (const asset of filtered) {
        const baseAsset = createAsset(asset.denom, BigInt(asset.amount));
        if (isLpDenom(asset.denom)) {
            lpAssets.push(baseAsset)
            continue
        }
        let finalAsset = await populateAssetFromChainRegistry(baseAsset);

        if (!finalAsset) {
            const metadataEntry = metadata[asset.denom]
            finalAsset = populateAssetFromBlockchainMetadata(baseAsset, metadataEntry)
        }

        result.assets.set(finalAsset.denom, finalAsset)
        if (isIbcDenom(finalAsset.denom) && finalAsset.IBCData && finalAsset.IBCData.chain.channelId !== '') {
            result.ibcData.set(finalAsset.IBCData.chain.channelId, finalAsset.IBCData)
        }
    }

    for (const lpAsset of lpAssets) {
        const split = lpAsset.denom.split('_')
        if (split.length !== 3) {
            continue;
        }

        const baseAsset = result.assets.get(split[1])
        const quoteAsset = result.assets.get(split[2])
        if (!baseAsset || !quoteAsset) {
            result.assets.set(lpAsset.denom, lpAsset)
            continue;
        }

        lpAsset.name = `${baseAsset.ticker}/${quoteAsset.ticker} LP Shares`
        lpAsset.ticker = `${baseAsset.ticker}/${quoteAsset.ticker} LP`
        lpAsset.verified = true
        lpAsset.decimals = LP_ASSETS_DECIMALS

        result.assets.set(lpAsset.denom, lpAsset)
    }

    return result
}

const populateIBCAsset = async (asset: Asset): Promise<Asset | undefined> => {
    const ibcList = getIBCAssetList()
    const ibcData = ibcList.find((item) => item.base === asset.denom)

    if (ibcData && ibcData.traces && ibcData.traces.length > 0) {
        const firstTrace = ibcData.traces.find((t) => t.type === "ibc") as unknown as IbcTransitionMock
        if (firstTrace) {
            const ibcAssetChain = getChains().find((c) => c.chainName === firstTrace.counterparty.chain_name)
            if (ibcAssetChain) {
                asset.name = ibcData.name
                asset.ticker = ibcData.symbol.toUpperCase()
                asset.decimals = getExponentByDenomFromAsset(ibcData, ibcData.display) ?? 0
                asset.logo = ibcData.logoURIs?.svg ?? ibcData.logoURIs?.png ?? TOKEN_LOGO_PLACEHOLDER
                asset.verified = true
                asset.IBCData = {
                    chain: {
                        channelId: firstTrace.chain.channel_id
                    },
                    counterparty: {
                        chainName: firstTrace.counterparty.chain_name,
                        channelId: firstTrace.counterparty.channel_id,
                        baseDenom: firstTrace.counterparty.base_denom,
                        chainPrettyName: ibcAssetChain.prettyName ?? ibcAssetChain.chainName,
                    }
                }

                return asset;
            }
        }
    }

    const ibcTrace = await getHashIBCTrace(asset.denom.replace('ibc/', ''))
    if (!ibcTrace) {
        return;
    }

    const splitPath = ibcTrace.path.split('/')
    if (splitPath.length < 2) {
        return
    }

    asset.IBCData = {
        chain: {
            channelId: splitPath[1]
        },
        counterparty: {
            chainName: "",
            channelId: "",
            baseDenom: "",
            chainPrettyName: ORIGIN_CHAIN_PLACEHOLDER,
        }
    }

    const denomOnCounterparty = await denomOnFirstHopChainFromTrace(ibcTrace)
    if (denomOnCounterparty) {
        asset.IBCData.counterparty.baseDenom = denomOnCounterparty
    }

    const counterPartyChain = await counterpartyChainForChannel(splitPath[1], splitPath[0])
    if (counterPartyChain) {
        asset.IBCData.counterparty.channelId = counterPartyChain.channelId
        const fullChain = getChainByChainId(counterPartyChain.chainId)
        if (fullChain) {
            asset.IBCData.counterparty.chainName = fullChain.chainName
            asset.IBCData.counterparty.chainPrettyName = fullChain.prettyName ?? fullChain.chainName
        }
    }

    const registryAssetChain = getAssetLists().find((item) => {
        const a = item.assets.find((i) => i.base === ibcTrace.base_denom)
        return !!a;
    })

    if (registryAssetChain) {
        const registryAsset = registryAssetChain.assets.find((i) => i.base === ibcTrace.base_denom) as ChainRegistryAsset
        asset.name = registryAsset.name
        asset.ticker = registryAsset.symbol.toUpperCase()
        asset.decimals = getExponentByDenomFromAsset(registryAsset, registryAsset.display) ?? 0
        asset.logo = registryAsset.logoURIs?.svg ?? registryAsset.logoURIs?.png ?? TOKEN_LOGO_PLACEHOLDER
        asset.verified = true

        return asset;
    }

    const localAsset = await populateAssetFromBZEChainRegistryAssetList(asset)
    if (localAsset) {
        localAsset.verified = true
        return localAsset
    }

    if (!ibcTrace.base_denom.includes('/')) {
        let counterPartyDenom = ibcTrace.base_denom
        if (counterPartyDenom.length > 10) {
            counterPartyDenom = truncateDenom(counterPartyDenom)
        }
        asset.name = counterPartyDenom
    }

    asset.verified = false
    asset.decimals = 0

    return asset;
}

const populateAssetFromChainRegistry = async (asset: Asset): Promise<Asset | undefined> => {
    if (isIbcDenom(asset.denom)) {
        return populateIBCAsset(asset)
    }

    if (isNativeDenom(asset.denom) || isFactoryDenom(asset.denom)) {
        return populateAssetFromBZEChainRegistryAssetList(asset)
    }

    return undefined
}

const populateAssetFromBZEChainRegistryAssetList = async (asset: Asset): Promise<Asset | undefined> => {
    const data = getAssetLists().find((item) => item.chainName.toLowerCase() === getChainName().toLowerCase())
    if (!data) {
        return undefined;
    }

    const assetData = data.assets.find(item => item.base === asset.denom)
    if (!assetData) {
        return undefined;
    }

    asset.decimals = getExponentByDenomFromAsset(assetData, assetData.display) ?? 0
    asset.name = assetData.name
    asset.ticker = assetData.display.toUpperCase()
    asset.logo = isNativeDenom(asset.denom) ? BZE_CIRCLE_LOGO : assetData.logoURIs?.svg ?? assetData.logoURIs?.png ?? TOKEN_LOGO_PLACEHOLDER

    return asset
}

const populateAssetFromBlockchainMetadata = (asset: Asset,  meta: MetadataSDKType|undefined): Asset => {
    if (!meta || meta.base !== asset.denom) {
        return asset;
    }

    if (meta.name.length > 0) {
        asset.name = meta.name
    }
    if (meta.symbol.length > 0) {
        asset.ticker = meta.symbol.toUpperCase()
    }

    if (meta.denom_units.length === 0) {
        return asset;
    }

    meta.denom_units.map(unit => {
        if (unit.denom === meta.display) {
            asset.decimals = unit.exponent
            asset.ticker = unit.denom.toUpperCase()
        }
    })

    return asset;
}

const createAsset = (denom: string, supply: bigint): Asset => {
    return {
        denom: denom,
        type: getDenomType(denom),
        name: truncateDenom(denom),
        ticker: truncateDenom(denom),
        decimals: 0,
        logo: TOKEN_LOGO_PLACEHOLDER,
        stable: STABLE_COINS[denom] ?? false,
        verified: VERIFIED_ASSETS[denom] ?? false,
        supply: supply,
    }
}

const getAllMetadataMap = async () => {
    const allMetadata = await getAllSupplyMetadata()
    if (!allMetadata) {
        return {};
    }

    return allMetadata.reduce<Record<string, MetadataSDKType>>((acc, asset: MetadataSDKType) => {
        acc[asset.base] = asset;
        return acc;
    }, {});
}
