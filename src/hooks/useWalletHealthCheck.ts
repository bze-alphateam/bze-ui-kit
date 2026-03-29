import {useEffect} from "react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {getChainName} from "../constants/chain";

const SIGNING_CLIENT_TIMEOUT_MS = 5_000;

/**
 * Validates the wallet connection on mount and proactively disconnects if the
 * wallet state restored from localStorage is stale (e.g. extension locked after
 * the user left the page for hours).
 *
 * interchain-kit persists WalletState.Connected + the account address in
 * localStorage and restores it on every page load without verifying the
 * extension is actually available. This hook catches that case by attempting
 * to create a signing client immediately on mount and calling disconnect() if
 * the attempt fails or times out — clearing the false "connected" UI state
 * before the user tries a transaction.
 *
 * Intentionally runs only once on mount (empty deps array) so it doesn't
 * interfere with normal connect/disconnect flows initiated by the user.
 */
export const useWalletHealthCheck = (chainName?: string) => {
    const {status, getSigningClient, disconnect} = useChain(chainName ?? getChainName());

    useEffect(() => {
        // Not connected at mount — nothing stale to validate
        if (status !== WalletState.Connected) return;

        const validate = async () => {
            try {
                const client = await Promise.race([
                    getSigningClient(),
                    new Promise<null>((resolve) =>
                        setTimeout(() => resolve(null), SIGNING_CLIENT_TIMEOUT_MS)
                    ),
                ]);

                if (!client) {
                    // Extension locked, unavailable, or timed out
                    disconnect();
                }
            } catch {
                // Extension threw — treat as unavailable
                disconnect();
            }
        };

        validate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally run once on mount only
};
