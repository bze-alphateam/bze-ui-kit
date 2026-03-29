import {Coin} from "@bze/bzejs/cosmos/base/v1beta1/coin";

/**
 * Creates a coin. Mirrors cosmjs `coin()` from @cosmjs/amino.
 */
export const coin = (amount: number | string, denom: string): Coin => {
    let outAmount: string;
    if (typeof amount === "number") {
        if (!Number.isInteger(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) {
            throw new Error("Given amount is not a safe integer. Consider using a string instead to overcome the limitations of JS numbers.");
        }
        outAmount = String(amount);
    } else {
        if (!amount.match(/^[0-9]+$/)) {
            throw new Error("Invalid unsigned integer string format");
        }
        outAmount = amount.replace(/^0*/, "") || "0";
    }
    return {amount: outAmount, denom};
};

/**
 * Creates a list of coins with one element. Mirrors cosmjs `coins()` from @cosmjs/amino.
 */
export const coins = (amount: number | string, denom: string): Coin[] => {
    return [coin(amount, denom)];
};

/**
 * Parses a coins string like "819966000ucosm,700000000ustake" into a Coin array.
 * Mirrors cosmjs `parseCoins()` from @cosmjs/amino.
 * Denom regex follows Cosmos SDK 0.53 (cosmos-sdk/types/coin.go).
 */
export const parseCoins = (input: string): Coin[] => {
    return input
        .replace(/\s/g, "")
        .split(",")
        .filter(Boolean)
        .map((part) => {
            const match = part.match(/^([0-9]+)([a-zA-Z][a-zA-Z0-9/:._-]{2,127})$/);
            if (!match) throw new Error("Got an invalid coin string");
            return {
                amount: match[1].replace(/^0+/, "") || "0",
                denom: match[2],
            };
        });
};
