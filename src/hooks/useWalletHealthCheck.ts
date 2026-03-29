import {useEffect, useRef} from "react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {getChainName} from "../constants/chain";
import {toaster} from "../components/toaster";

const SIGNING_CLIENT_TIMEOUT_MS = 5_000;

/**
 * Validates the wallet connection on mount and proactively disconnects if the
 * wallet state restored from localStorage is stale (extension locked, or account
 * switched outside the UI between sessions).
 *
 * interchain-kit persists WalletState.Connected + the account address in
 * localStorage and restores it on every page load without re-verifying the
 * extension. This hook catches that by calling refreshAccount() — interchain-kit's
 * own method for forcing a live fetch from the extension — and comparing the result
 * against the cached address. On mismatch or failure, shows a toast and disconnects.
 *
 * Runs on every status change (not just mount) because interchain-kit restores state
 * asynchronously, so status is Disconnected on the first render and only becomes
 * Connected after its own useEffect/init() completes. The hasValidated ref ensures
 * we only run the check once per page load.
 */
export const useWalletHealthCheck = (chainName?: string) => {
    const {status, disconnect, address, wallet} = useChain(chainName ?? getChainName());
    const hasValidated = useRef(false);

    useEffect(() => {
        if (status !== WalletState.Connected) return;
        if (hasValidated.current) return;
        hasValidated.current = true;

        const validate = async () => {
            try {
                // refreshAccount() is interchain-kit's own method for forcing a live
                // fetch from the extension, bypassing the localStorage cache that
                // getAccount() returns when an account is already stored. It calls
                // CosmosWallet.getAccount() → extension.getKey() directly.
                const refreshed = await Promise.race([
                    (wallet as any)?.refreshAccount?.().then(() => true),
                    new Promise<false>((resolve) =>
                        setTimeout(() => resolve(false), SIGNING_CLIENT_TIMEOUT_MS)
                    ),
                ]);

                if (!refreshed) {
                    console.error("[useWalletHealthCheck] refreshAccount timed out — wallet may be locked. Disconnecting.");
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

                // After refreshAccount() the store holds the live account.
                // getAccount() will now return it from the freshly updated cache.
                const freshAccount = await (wallet as any)?.getAccount?.();
                const freshAddress = freshAccount?.address;

                if (freshAddress && freshAddress !== address) {
                    console.error(`[useWalletHealthCheck] Address mismatch — interchain-kit cached "${address}" but extension reports "${freshAddress}". Wallet was switched outside the UI. Disconnecting.`);
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
    }, [status]);
};
