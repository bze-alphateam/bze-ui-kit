interface Window {
    keplr?: {
        experimentalSuggestChain: (chainInfo: unknown) => Promise<void>;
    };
}
