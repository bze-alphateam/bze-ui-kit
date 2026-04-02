import {useEffect, useRef} from "react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {getChainName} from "../constants/chain";
import {toaster} from "../components/toaster";

const REFRESH_TIMEOUT_MS = 2_000;
const INITIAL_DELAY_MS = 2_000;
const MAX_RETRIES = 3;

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
 * After a page refresh, wallet extensions (Keplr, Leap) inject their API asynchronously.
 * To avoid false negatives we wait an initial 2 seconds before the first attempt, then
 * retry up to 3 times with 2-second timeouts (8 seconds worst case) before disconnecting.
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

        let cancelled = false;

        const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

        const tryRefresh = async (): Promise<boolean> => {
            const refreshed = await Promise.race([
                (wallet as any)?.refreshAccount?.().then(() => true),
                new Promise<false>((resolve) =>
                    setTimeout(() => resolve(false), REFRESH_TIMEOUT_MS)
                ),
            ]);
            return !!refreshed;
        };

        const validate = async () => {
            // Wait for wallet extension to initialize after page refresh
            await sleep(INITIAL_DELAY_MS);
            if (cancelled) return;

            try {
                let refreshed = false;
                for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                    if (cancelled) return;
                    refreshed = await tryRefresh();
                    if (refreshed) break;
                }

                if (cancelled) return;

                if (!refreshed) {
                    console.error("[useWalletHealthCheck] refreshAccount failed after retries — wallet may be locked. Disconnecting.");
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

                if (cancelled) return;

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
                if (cancelled) return;
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

        return () => { cancelled = true; };
    }, [status]);
};
