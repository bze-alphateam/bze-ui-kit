import {EventCallback, InternalEvent} from "../types/events";
import {getMarketEventKey} from "../utils/events";

class BlockchainEventManager {
    private static instance: BlockchainEventManager;
    private listeners = new Map<string, Set<EventCallback>>();

    private constructor() {}

    static getInstance(): BlockchainEventManager {
        if (!BlockchainEventManager.instance) {
            BlockchainEventManager.instance = new BlockchainEventManager();
        }
        return BlockchainEventManager.instance;
    }

    subscribe(eventType: string, callback: EventCallback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }

        this.listeners.get(eventType)!.add(callback);

        return () => {
            const handlers = this.listeners.get(eventType);
            if (handlers) {
                handlers.delete(callback);
                if (handlers.size === 0) {
                    this.listeners.delete(eventType);
                }
            }
        };
    }

    emit(eventType: string, event?: InternalEvent) {
        const generalListeners = this.listeners.get(eventType);
        if (generalListeners) {
            generalListeners.forEach(callback => callback(event));
        }

        if (!event) {
            return;
        }

        if (event.marketId) {
            const marketListeners = this.listeners.get(getMarketEventKey(eventType, event.marketId));
            if (marketListeners) {
                marketListeners.forEach(callback => callback(event));
            }
        }
    }
}

export const blockchainEventManager = BlockchainEventManager.getInstance();
