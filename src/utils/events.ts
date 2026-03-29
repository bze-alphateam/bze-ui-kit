import {Attribute, ORDER_BOOK_CHANGED_EVENT, TendermintEvent} from "../types/events";
import {getChainNativeAssetDenom} from "../constants/assets";
import {coins, parseCoins} from "./coins";

export const getMarketOrderBookChangedEvent = (marketId: string) => getMarketEventKey(ORDER_BOOK_CHANGED_EVENT, marketId)
export const getMarketEventKey = (eventType: string, marketId: string) => `${eventType}:${marketId}`

export const mapEventAttributes = (attributes: Attribute[]): Record<string, string> => {
    return attributes.reduce((acc, attr) => ({ ...acc, [attr.key]: attr.value.replace('\"', '').replace('\"', '') }), {});
}

export const getEventKeyValue = (event: TendermintEvent, key: string): string | undefined => {
    return event.attributes.find(attribute => attribute.key === key)?.value;
}

export const getEventMarketId = (event: TendermintEvent): string | undefined => {
    return getEventKeyValue(event, 'market_id')?.replaceAll('"', '');
}

export const isAddressTransfer = (address: string, event: TendermintEvent): boolean => {
    if (address === '' || event.type !== 'transfer') return false;
    return event.attributes.find(attribute => attribute.value === address) !== undefined;
}

export const isOrderBookEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('bze.tradebin.Order');
}

export const isOrderExecutedEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('bze.tradebin.OrderExecutedEvent');
}

export const isSwapEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('bze.tradebin.SwapEvent');
}

export const isCoinbaseEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('coinbase');
}

export const isBurnEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('burn');
}

export const isEpochStartEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('bze.epochs.EpochStartEvent');
}

export const getMintedAmount = (event: TendermintEvent) => {
    const defaultCoin = coins(0, getChainNativeAssetDenom());
    try {
        const amountAttribute = event.attributes.find(attribute => attribute.key === 'amount');
        return amountAttribute ? parseCoins(amountAttribute.value) : defaultCoin;
    } catch (e) {
        console.error('Failed to parse minted amount from coinbase event', e);
        return defaultCoin;
    }
}
