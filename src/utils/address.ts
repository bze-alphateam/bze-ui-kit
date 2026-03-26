import {fromBech32} from "@interchainjs/encoding";
import {AddressValidationResult} from "../types/validation";
import {getChainAddressPrefix} from "../constants/chain";
import {stringTruncateFromCenter} from "./strings";

export const truncateAddress = (address: string): string => {
    return stringTruncateFromCenter(address, 12);
}

export const validateBech32Address = (address: string, prefix: string): AddressValidationResult => {
    const result = {
        isValid: false,
        message: ""
    }

    try {
        const { prefix: addressPrefix } = fromBech32(address);
        if (addressPrefix === prefix) {
            result.isValid = true;
            return result;
        }

        result.message = `This address is from another network (${addressPrefix}). Please use an address from the destination network (${prefix}).`
    } catch (e) {
        console.error("invalid address ", e);
        result.message = "Invalid address"
    }

    return result;
}

export const validateBZEBech32Address = (address: string) => validateBech32Address(address, getChainAddressPrefix());
