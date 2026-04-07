'use client'

import {type ReactNode, useRef} from 'react';
import {WagmiProvider, useAccount} from 'wagmi';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {EvmWalletContext, type EvmWalletState} from '../evm/context';
import type {Config} from 'wagmi';

interface EvmProviderProps {
    config: Config;
    children: ReactNode;
}

/**
 * Internal bridge that reads wagmi's `useAccount()` and feeds the state into
 * `EvmWalletContext`. This sits inside `WagmiProvider` so the hook works,
 * and provides context to everything below.
 */
const EvmWalletBridge = ({children}: { children: ReactNode }) => {
    const {isConnected, address, chainId} = useAccount();

    const state: EvmWalletState = {
        isAvailable: true,
        isConnected,
        address,
        chainId,
    };

    return (
        <EvmWalletContext.Provider value={state}>
            {children}
        </EvmWalletContext.Provider>
    );
};

/**
 * Opt-in EVM wallet provider. Wrap your app with this to enable EVM chain
 * support in the Buy BZE form and any future EVM-aware components.
 *
 * ```tsx
 * import { EvmProvider, createEvmConfig } from '@bze/bze-ui-kit';
 *
 * const evmConfig = createEvmConfig({ projectId: '...' });
 *
 * <ChainProvider ...>
 *   <EvmProvider config={evmConfig}>
 *     <ChakraProvider ...>
 *       {children}
 *     </ChakraProvider>
 *   </EvmProvider>
 * </ChainProvider>
 * ```
 *
 * Apps that don't render `EvmProvider` see identical behavior to before —
 * EVM chains show "Coming soon" in the picker and can't be selected.
 */
export const EvmProvider = ({config, children}: EvmProviderProps) => {
    // Create a stable QueryClient once per provider instance
    const queryClientRef = useRef<QueryClient | null>(null);
    if (!queryClientRef.current) {
        queryClientRef.current = new QueryClient({
            defaultOptions: {
                queries: {
                    staleTime: 60_000,
                    refetchOnWindowFocus: false,
                },
            },
        });
    }

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClientRef.current}>
                <EvmWalletBridge>
                    {children}
                </EvmWalletBridge>
            </QueryClientProvider>
        </WagmiProvider>
    );
};
