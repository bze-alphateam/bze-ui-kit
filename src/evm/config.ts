import {http, createConfig} from 'wagmi';
import {
    mainnet, bsc, polygon, arbitrum, optimism, base, avalanche,
} from 'wagmi/chains';

export interface EvmConfigOptions {
    /** WalletConnect project ID. Required for WalletConnect support. */
    projectId: string;
    /** App name shown in wallet UIs. */
    appName?: string;
    /** App URL shown in wallet UIs. */
    appUrl?: string;
    /** App icon URL shown in wallet UIs. */
    appIcon?: string;
}

/** Module-scoped storage for config options — used by useEvmWallet for on-demand connector creation. */
let storedConfigOptions: EvmConfigOptions | undefined;

/**
 * Create a wagmi config for EVM wallet support. Call once at module scope
 * in each consuming app and pass to `<EvmProvider config={config}>`.
 *
 * IMPORTANT: No connectors are registered at creation time. Wagmi's
 * `injected()` connector auto-discovers wallets on page load and triggers
 * their connect prompts (MetaMask, Phantom, etc.) — we don't want that.
 * Instead, connectors are passed explicitly when the user clicks the
 * connect button in the Buy BZE form via `useConnect().connectAsync()`.
 */
export const createEvmConfig = (options: EvmConfigOptions) => {
    storedConfigOptions = options;

    return createConfig({
        chains: [mainnet, bsc, polygon, arbitrum, optimism, base, avalanche],
        connectors: [], // Empty — connectors are created on-demand in useEvmWallet
        transports: {
            [mainnet.id]: http(),
            [bsc.id]: http(),
            [polygon.id]: http(),
            [arbitrum.id]: http(),
            [optimism.id]: http(),
            [base.id]: http(),
            [avalanche.id]: http(),
        },
    });
};

/** Retrieve the stored config options for on-demand connector creation. */
export const getEvmConfigOptions = (): EvmConfigOptions | undefined => {
    return storedConfigOptions;
};
