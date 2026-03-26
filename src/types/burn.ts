import BigNumber from 'bignumber.js';

export interface BurnHistoryItem {
    denom: string;
    amount: BigNumber;
    usdValue: BigNumber;
    blockHeight: string;
    timestamp: string;
    date?: Date;
}

export interface NextBurn {
    coins: {
        denom: string;
        amount: string;
    }[],
    date: Date;
}
