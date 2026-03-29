import {useEffect} from "react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {getChainName} from "../constants/chain";
import {toaster} from "../components/toaster";

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
    const {status, getSigningClient, disconnect, address} = useChain(chainName ?? getChainName());

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
                    const msg = "[useWalletHealthCheck] Signing client unavailable or timed out — wallet may be locked. Disconnecting.";
                    console.error(msg);
                    toaster.create({
                        title: "Wallet disconnected",
                        description: "Could not reach your wallet extension. Please reconnect.",
                        type: "error",
                        duration: 8000,
                        closable: true,
                    });
                    disconnect();
                    return;
                }

                // Detect the case where the user switched wallet accounts OUTSIDE
                // the UI (close tab → switch account in extension → reopen tab).
                // interchain-kit restores the old address from localStorage but
                // the extension's signer belongs to the new account — any attempt
                // to broadcast would fail with "signers mismatch".
                const accounts = await (client as any).getAccounts?.();
                if (accounts?.length > 0 && accounts[0].address !== address) {
                    const msg = `[useWalletHealthCheck] Address mismatch — interchain-kit cached "${address}" but signing client reports "${accounts[0].address}". Wallet was likely switched outside the UI. Disconnecting.`;
                    console.error(msg);
                    toaster.create({
                        title: "Wallet account changed",
                        description: "Your wallet account changed since your last visit. Please reconnect.",
                        type: "warning",
                        duration: 8000,
                        closable: true,
                    });
                    disconnect();
                }
            } catch (err) {
                // Extension threw — treat as unavailable
                console.error("[useWalletHealthCheck] Error validating wallet connection:", err);
                toaster.create({
                    title: "Wallet connection error",
                    description: "Could not verify your wallet connection. Please reconnect.",
                    type: "error",
                    duration: 8000,
                    closable: true,
                });
                disconnect();
            }
        };

        validate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally run once on mount only
};
