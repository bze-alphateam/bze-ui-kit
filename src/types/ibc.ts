
export interface DenomTrace {
    base_denom: string;
    path: string;
}

export interface CounterpartyChainForChannel {
    channelId: string; //the channel id of the counterparty chain to our chain
    chainId: string; // the chain id of the counterparty chain for this channel
}
