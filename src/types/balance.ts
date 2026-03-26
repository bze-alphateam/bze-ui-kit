import BigNumber from "bignumber.js";

export interface Balance {
    denom: string;
    amount: BigNumber;
}

// the amount is already transformed from uAmount to amount
export type PrettyBalance = Balance
