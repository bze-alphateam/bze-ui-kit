export interface Attribute {
    key: string;
    value: string;
    index: boolean;
}

export interface TendermintEvent {
    type: string;
    attributes: Attribute[];
}

export interface InternalEvent {
    marketId?: string;
    blockHeight?: number;
}

export type EventCallback = (event?: InternalEvent) => void;

export const CURRENT_WALLET_BALANCE_EVENT = "current_wallet_balance";
export const ORDER_EXECUTED_EVENT = "order_executed";
export const ORDER_BOOK_CHANGED_EVENT = "order_book_changed";
export const SUPPLY_CHANGED_EVENT = "supply_changed";
export const SWAP_EXECUTED_EVENT = "swap_executed";
export const NEXT_BURN_CHANGED_EVENT = "next_burn_changed";
export const RAFFLE_CHANGED_EVENT = "raffle_changed";
export const LOCK_CHANGED_EVENT = "lock_changed";
export const EPOCH_START_EVENT = "epoch_start";
