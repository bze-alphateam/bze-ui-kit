
export const ASSET_TYPE_FACTORY = "Factory"
export const ASSET_TYPE_IBC = "IBC"
export const ASSET_TYPE_NATIVE = "Native"
export const ASSET_TYPE_LP = "LP"

export const VERIFIED_ASSETS: { [key: string]: boolean } = {
    "factory/testbz1w9vva0muctcrmd9xgret9x4wasw2rrflsdkwfs/faneatiku2": true,
    "factory/testbz1z3mkcr2jz424w6m49frgjmy9uhlrx69p4cvrgf/vidulum": true,
    "factory/testbz1z3mkcr2jz424w6m49frgjmy9uhlrx69p4cvrgf/bitcoinz": true,
    "ubze": true,
    "utbz": true,
    "factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl": true,
    "factory/bze15pqjgk4la0mfphwddce00d05n3th3u66n3ptcv/2MARS": true,
    "factory/bze12gyp30f29zg26nuqrwdhl26ej4q066pt572fhm/GGE": true,
}

export const EXCLUDED_ASSETS: { [key: string]: boolean } = {
    "factory/testbz1w9vva0muctcrmd9xgret9x4wasw2rrflsdkwfs/faneatiku1": false,
    "factory/bze1972aqfzdg29ugjln74edx0xvcg4ehvysjptk77/1000000000": true,
    "ibc/689DD6F80E4DBCE14877462B182504037FAEAD0699D5804A7F5CB328D33ED24B": true,
    "factory/bze1f0qgels0eu96ev6a67znu70q7rquy9eragn8nw/ucorey": true,
}

export const STABLE_COINS: { [key: string]: boolean } = {
    "factory/testbz1z3mkcr2jz424w6m49frgjmy9uhlrx69p4cvrgf/uusdt": true,
    "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd": true,
    "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4": true,
}

export const getChainNativeAssetDenom = (): string => {
    return process.env.NEXT_PUBLIC_CHAIN_NATIVE_ASSET_DENOM || 'ubze'
}

export const getUSDCDenom = (): string => {
    return process.env.NEXT_PUBLIC_USDC_IBC_DENOM || ''
}
