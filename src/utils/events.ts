import {Attribute, ORDER_BOOK_CHANGED_EVENT} from "../types/events";

export const getMarketOrderBookChangedEvent = (marketId: string) => getMarketEventKey(ORDER_BOOK_CHANGED_EVENT, marketId)
export const getMarketEventKey = (eventType: string, marketId: string) => `${eventType}:${marketId}`

export const mapEventAttributes = (attributes: Attribute[]): Record<string, string> => {
    return attributes.reduce((acc, attr) => ({ ...acc, [attr.key]: attr.value.replace('\"', '').replace('\"', '') }), {});
}
