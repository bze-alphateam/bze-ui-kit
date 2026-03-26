
export const LP_ASSETS_DECIMALS = 12

export interface Asset {
    type: string; //ibc, factory or native
    denom: string; //base denom (blockchain denom)
    decimals: number; //exponent
    name: string;
    ticker: string;
    logo: string; //logo or placeholder
    stable: boolean; //is stablecoin
    verified: boolean; //is verified
    supply: bigint; //total supply on BZE chain
    IBCData?: IBCData;
}

export interface IBCData {
    chain: IBCChainData;
    counterparty: IBCCounterparty;
}

export interface IBCCounterparty {
    chainName: string;
    chainPrettyName: string;
    channelId: string;
    baseDenom: string;
}

interface IBCChainData {
    channelId: string;
}

// we created a custom interface that we can use to mock the traces of type IbcTransition
// this is needed because the IbcTransition type from chain-registry/utils is not actually what we get from the chain-registry
// the IbcTransition type has fields camelCase while the chain-registry returns fields with snake_case
export interface IbcTransitionMock {
    type: "ibc";
    counterparty: {
        chain_name: string;
        base_denom: string;
        channel_id: string;
    };
    chain: {
        channel_id: string;
        path?: string;
    };
}

export interface ChainAssets {
    assets: Map<string, Asset>;
    ibcData: Map<string, IBCData>;
}
