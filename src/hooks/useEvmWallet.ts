'use client'

import {useCallback} from 'react';
import {useAccount, useConnect, useDisconnect, useSwitchChain} from 'wagmi';
import {injected, walletConnect} from 'wagmi/connectors';
import {getEvmConfigOptions} from '../evm/config';
import {useEvmWalletState} from '../evm/context';

export interface UseEvmWalletReturn {
    isConnected: boolean;
    address?: string;
    chainId?: number;
    /** Connect with injected wallet (MetaMask / Rabby) */
    connectInjected: () => Promise<void>;
    /** Connect with WalletConnect */
    connectWalletConnect: () => Promise<void>;
    /** Disconnect the current EVM wallet */
    disconnect: () => Promise<void>;
    /** Switch to a different EVM chain. MetaMask will prompt to add the chain if unknown. */
    switchChain: (chainId: number) => Promise<void>;
    /** Whether an injected wallet (MetaMask) is available in the browser */
    hasInjected: boolean;
}

const NOOP_ASYNC = async () => {};

/**
 * Null return used when EvmProvider is not in the tree. All methods are
 * no-ops, state is disconnected. Allows consumers to call the hook
 * unconditionally without checking isAvailable first.
 */
const NULL_WALLET: UseEvmWalletReturn = {
    isConnected: false,
    address: undefined,
    chainId: undefined,
    connectInjected: NOOP_ASYNC,
    connectWalletConnect: NOOP_ASYNC,
    disconnect: NOOP_ASYNC,
    switchChain: NOOP_ASYNC,
    hasInjected: false,
};

/**
 * Unified EVM wallet hook. Safe to call anywhere — returns a no-op fallback
 * when EvmProvider is not in the React tree. Connectors are created on-demand
 * when the user clicks connect (not at page load), preventing MetaMask/Phantom
 * auto-discovery popups.
 */
export function useEvmWallet(): UseEvmWalletReturn {
    const {isAvailable} = useEvmWalletState();

    // When EvmProvider is absent, wagmi hooks would throw. Return safe defaults.
    if (!isAvailable) return NULL_WALLET;

    return useEvmWalletInner();
}

/**
 * Inner implementation — only called when WagmiProvider is guaranteed to be
 * in the tree (isAvailable === true). Separated so the conditional return
 * above doesn't violate the rules of hooks.
 */
function useEvmWalletInner(): UseEvmWalletReturn {
    const {isConnected, address, chainId} = useAccount();
    const {connectAsync} = useConnect();
    const {disconnectAsync} = useDisconnect();
    const {switchChainAsync} = useSwitchChain();

    const hasInjected = typeof window !== 'undefined' && !!(window as any).ethereum;

    const connectInjected = useCallback(async () => {
        const connector = injected();
        await connectAsync({connector});
    }, [connectAsync]);

    const connectWalletConnect = useCallback(async () => {
        const options = getEvmConfigOptions();
        if (!options?.projectId) throw new Error('WalletConnect projectId not configured');
        const connector = walletConnect({
            projectId: options.projectId,
            metadata: {
                name: options.appName ?? 'BeeZee',
                description: 'BeeZee DEX',
                url: options.appUrl ?? 'https://dex.getbze.com',
                icons: options.appIcon ? [options.appIcon] : [],
            },
        });
        await connectAsync({connector});
    }, [connectAsync]);

    const disconnect = useCallback(async () => {
        await disconnectAsync();
    }, [disconnectAsync]);

    const switchChain = useCallback(async (targetChainId: number) => {
        await switchChainAsync({chainId: targetChainId});
    }, [switchChainAsync]);

    return {
        isConnected,
        address,
        chainId,
        connectInjected,
        connectWalletConnect,
        disconnect,
        switchChain,
        hasInjected,
    };
}
