import {toBigNumber} from "./amount";
import BigNumber from "bignumber.js";

export const sanitizeNumberInput = (input: string) => {
    let sanitized = input.replace(/[^0-9.,]/g, '');
    sanitized = sanitized.replace(",", ".");

    const parts = sanitized.split('.');
    if (parts.length > 2) {
        sanitized = parts[0] + '.' + parts.slice(1).join('');
    }

    return sanitized;
}

export const sanitizeIntegerInput = (input: string): string => {
    if (input.length === 0) {
        return "";
    }

    const sanitized = input.replace(/[^0-9]/g, '');

    const parsed = parseInt(sanitized, 10);
    if (!parsed) {
        return "1";
    }

    return `${parsed}`;
}

export const toPercentage = (dec: number|bigint|BigNumber|string) => toBigNumber(dec).multipliedBy(100).decimalPlaces(2).toString();
