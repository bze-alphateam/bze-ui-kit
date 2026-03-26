import {getChainNativeAssetDenom} from "./assets";

export const BZE_TESTNET_2_SUGGEST_CHAIN = {
    chainId: "bzetestnet-3",
    chainType: "cosmos",
    chainName: "BeeZee Testnet 3",
    prettyName: 'BeeZee Testnet 3',
    networkType: 'mainnet',
    bech32Prefix: "bze",
    status: "live",
    slip44: 118,
    logoURIs: {
        svg: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/images/bze.svg',
    },
    fees: {
        feeTokens: [
            {
                denom: getChainNativeAssetDenom(),
                fixedMinGasPrice: 0.01,
                lowGasPrice: 0.01,
                averageGasPrice: 0.025,
                highGasPrice: 0.04
            }
        ]
    },
    keyAlgos: [
        "secp256k1"
    ],
    staking: {
        stakingTokens: [
            {
                denom: getChainNativeAssetDenom()
            }
        ]
    },
    explorers: [
        {
            "kind": "ping.pub",
            "url": "https://testnet.explorer.thesilverfox.pro/beezee",
            "tx_page": "https://testnet.explorer.thesilverfox.pro/beezee/tx/${txHash}"
        }
    ],
    codebase: {
        "git_repo": "https://github.com/bze-alphateam/bze",
        "recommended_version": "v5.1.2",
        "compatible_versions": [
            "v5.1.2"
        ],
        "binaries": {
            "darwin/amd64": "https://github.com/bze-alphateam/bze/releases/download/v5.1.2/bze-5.1.2-darwin-amd64.tar.gz",
            "darwin/arm64": "https://github.com/bze-alphateam/bze/releases/download/v5.1.2/bze-5.1.2-darwin-arm64.tar.gz",
            "linux/amd64": "https://github.com/bze-alphateam/bze/releases/download/v5.1.2/bze-5.1.2-linux-amd64.tar.gz",
            "linux/arm64": "https://github.com/bze-alphateam/bze/releases/download/v5.1.2/bze-5.1.2-linux-arm64.tar.gz",
            "windows/amd64": "https://github.com/bze-alphateam/bze/releases/download/v5.1.2/bze-5.1.2-win64.zip"
        },
        "genesis": {
            "genesis_url": "https://raw.githubusercontent.com/bze-alphateam/bze/main/genesis.json"
        }
    },
    apis: {
        "rpc": [
            {
                "address": "https://testnet-rpc.getbze.com",
                "provider": "AlphaTeam"
            }
        ],
        "rest": [
            {
                "address": "https://testnet.getbze.com",
                "provider": "AlphaTeam"
            },
        ],
        "grpc": [
            {
                "address": "grpc.getbze.com:9999",
                "provider": "AlphaTeam"
            }
        ]
    }
};

export const BZE_TESTNET_NETWORK = {
    base: {
        explorerBaseUrl: 'https://explorer.getbze.com/bze%20testnet',
        rpcUrl: 'https://testnet-rpc.getbze.com',
        restUrl: 'https://testnet.getbze.com',
        chainName: BZE_TESTNET_2_SUGGEST_CHAIN.chainName,
    },
    chain: [BZE_TESTNET_2_SUGGEST_CHAIN],
    assets: [
        {
            chainName: BZE_TESTNET_2_SUGGEST_CHAIN.chainName,
            assets: [
                {
                    "description": "BeeZee native blockchain",
                    "typeAsset": "sdk.coin",
                    "denomUnits": [
                        {
                            "denom": getChainNativeAssetDenom(),
                            "exponent": 0
                        },
                        {
                            "denom": "TBZE",
                            "exponent": 6
                        }
                    ],
                    "base": getChainNativeAssetDenom(),
                    "name": "BeeZee",
                    "display": "TBZE",
                    "symbol": "TBZE",
                    "logoURIs": {
                        "svg": "https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/images/bze.svg",
                        "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/images/bze.png"
                    },
                    "coingeckoId": "bzedge"
                },
                {
                    "description": "Lumen",
                    "typeAsset": "sdk.coin",
                    "denomUnits": [
                        {
                            "denom": "ibc/9DA252F9F9C86132CC282EA431DFB7DE7729501F6DC9A3E0F50EC8C6EE380CC7",
                            "exponent": 0,
                            "aliases": []
                        },
                        {
                            "denom": "LMN",
                            "exponent": 6,
                            "aliases": []
                        },
                    ],
                    "base": "ibc/9DA252F9F9C86132CC282EA431DFB7DE7729501F6DC9A3E0F50EC8C6EE380CC7",
                    "display": "LMN",
                    "name": "Lumen",
                    "symbol": "LMN",
                    "logoURIs": {
                        "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/lumen/images/lmn.png"
                    }
                },
                {
                    "description": "Vidulum app token",
                    "typeAsset": "sdk.coin",
                    "denomUnits": [
                        {
                            "denom": "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum",
                            "exponent": 0,
                            "aliases": []
                        },
                        {
                            "denom": "VDL",
                            "exponent": 6,
                            "aliases": []
                        },
                    ],
                    "base": "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum",
                    "display": "VDL",
                    "name": "Vidulum",
                    "symbol": "VDL",
                    "logoURIs": {
                        "png": "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/beezee/factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl.png"
                    }
                },
            ]
        }
    ]
}
