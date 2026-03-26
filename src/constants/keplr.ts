export const MAINNET_CHAIN_INFO_FALLBACK = {
    "chainId": "beezee-1",
    "chainName": "BeeZee",
    "chainSymbolImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/beezee/chain.png",
    "rpc": "https://rpc.getbze.com",
    "rest": "https://rest.getbze.com",
    "nodeProvider": {
        "name": "BZE Alpha Team",
        "email": "alphateam@getbze.com",
        "website": "https://getbze.com"
    },
    "stakeCurrency": {
        "coinDenom": "BZE",
        "coinMinimalDenom": "ubze",
        "coinDecimals": 6,
        "coinGeckoId": "bzedge",
        "coinImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/beezee/chain.png"
    },
    "bip44": {
        "coinType": 118
    },
    "bech32Config": {
        "bech32PrefixAccAddr": "bze",
        "bech32PrefixAccPub": "bzepub",
        "bech32PrefixValAddr": "bzevaloper",
        "bech32PrefixValPub": "bzevaloperpub",
        "bech32PrefixConsAddr": "bzevalcons",
        "bech32PrefixConsPub": "bzevalconspub"
    },
    "currencies": [
        {
            "coinDenom": "BZE",
            "coinMinimalDenom": "ubze",
            "coinDecimals": 6,
            "coinGeckoId": "bzedge",
            "coinImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/beezee/chain.png"
        },
        {
            "coinDenom": "VDL",
            "coinMinimalDenom": "factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl",
            "coinDecimals": 6,
            "coinGeckoId": "vidulum",
            "coinImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/beezee/factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl.png"
        }
    ],
    "feeCurrencies": [{
        "coinDenom": "BZE",
        "coinMinimalDenom": "ubze",
        "coinDecimals": 6,
        "coinGeckoId": "bzedge",
        "gasPriceStep": {
            "low": 0.001,
            "average": 0.01,
            "high": 0.1
        },
        "coinImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/beezee/chain.png"
    }],
    "features": []
};

export const TESTNET_CHAIN_INFO_FALLBACK = {
    "chainId": "bzetestnet-3",
    "chainName": "BeeZee Testnet 3",
    "chainSymbolImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/bzetestnet/chain.png",
    "rpc": "https://testnet-rpc.getbze.com",
    "rest": "https://testnet.getbze.com",
    "nodeProvider": {
        "name": "BZE Alpha Team",
        "email": "alphateam@getbze.com",
        "website": "https://getbze.com"
    },
    "stakeCurrency": {
        "coinDenom": "TBZE",
        "coinMinimalDenom": "ubze",
        "coinDecimals": 6,
        "coinGeckoId": "bzedge",
        "coinImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/bzetestnet/chain.png"
    },
    "bip44": {
        "coinType": 118
    },
    "bech32Config": {
        "bech32PrefixAccAddr": "bze",
        "bech32PrefixAccPub": "bzepub",
        "bech32PrefixValAddr": "bzevaloper",
        "bech32PrefixValPub": "bzevaloperpub",
        "bech32PrefixConsAddr": "bzevalcons",
        "bech32PrefixConsPub": "bzevalconspub"
    },
    "currencies": [
        {
            "coinDenom": "TBZE",
            "coinMinimalDenom": "ubze",
            "coinDecimals": 6,
            "coinGeckoId": "bzedge",
            "coinImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/bzetestnet/chain.png"
        },
        {
            "coinDenom": "TVDL",
            "coinMinimalDenom": "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum",
            "coinDecimals": 6,
            "coinGeckoId": "vidulum",
            "coinImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/bzetestnet/factory/testbz1z3mkcr2jz424w6m49frgjmy9uhlrx69p4cvrgf/vidulum.png"
        }
    ],
    "feeCurrencies": [{
        "coinDenom": "TBZE",
        "coinMinimalDenom": "ubze",
        "coinDecimals": 6,
        "coinGeckoId": "bzedge",
        "gasPriceStep": {
            "low": 0.001,
            "average": 0.01,
            "high": 0.1
        },
        "coinImageUrl": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/bzetestnet/chain.png"
    }],
    "features": []
};
