import {stringTruncateFromCenter} from "./strings";
import {
    ASSET_TYPE_FACTORY,
    ASSET_TYPE_IBC,
    ASSET_TYPE_LP,
    ASSET_TYPE_NATIVE,
    getChainNativeAssetDenom
} from "../constants/assets";
import {Asset} from "../types/asset";

const MAX_DENOM_LEN = 8;

export const isFactoryDenom = (denom: string) => denom.startsWith("factory/");
export const isIbcDenom = (denom: string) => denom.startsWith("ibc/");
export const isLpDenom = (denom: string) => denom.startsWith("ulp_");
export const isNativeDenom = (denom: string) => getChainNativeAssetDenom() === denom;

export const getDenomType = (denom: string) => isFactoryDenom(denom) ? ASSET_TYPE_FACTORY : isIbcDenom(denom) ? ASSET_TYPE_IBC: isLpDenom(denom) ? ASSET_TYPE_LP : ASSET_TYPE_NATIVE;

export function truncateDenom(denom: string) {
    return stringTruncateFromCenter(denom, MAX_DENOM_LEN);
}

export const isIbcAsset = (asset: Asset): boolean => asset.type === ASSET_TYPE_IBC;
