'use client'

import {createContext, useContext} from 'react';

/**
 * EVM wallet state exposed via React context. Components read this to check
 * whether an EVM wallet is connected and get the active address/chainId
 * without calling wagmi hooks directly (which would throw outside WagmiProvider).
 *
 * The safe default (`isConnected: false`) means code that reads this context
 * works identically whether or not `EvmProvider` is in the tree — no crashes,
 * no conditional hook calls. Apps without EVM support simply never see
 * `isConnected: true`.
 */
export interface EvmWalletState {
    /** Whether the EvmProvider is present in the React tree. */
    isAvailable: boolean;
    isConnected: boolean;
    address?: string;     // 0x hex address
    chainId?: number;     // active EVM chain ID
}

const DEFAULT_STATE: EvmWalletState = {
    isAvailable: false,
    isConnected: false,
    address: undefined,
    chainId: undefined,
};

export const EvmWalletContext = createContext<EvmWalletState>(DEFAULT_STATE);

/**
 * Read the current EVM wallet state from context. Safe to call anywhere —
 * returns the disconnected default when no `EvmProvider` is present.
 */
export const useEvmWalletState = (): EvmWalletState => {
    return useContext(EvmWalletContext);
};
