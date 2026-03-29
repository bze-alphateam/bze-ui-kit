import {useCallback, useEffect, useRef, useState} from "react";
import {useChain} from "@interchain-kit/react";
import {getChainName} from "../constants/chain";
import {registerBzeEncoders} from "../utils/signing_client_setup";

interface UseSigningClientProps {
    chainName?: string;
}

export const useSigningClient = ({chainName}: UseSigningClientProps): {
    signingClientError: unknown;
    signingClient: unknown;
    isSigningClientReady: boolean;
} => {
    const {getSigningClient, signingClientError, wallet, chain} = useChain(chainName ?? getChainName());
    const [signingClient, setSigningClient] = useState<Awaited<ReturnType<typeof getSigningClient>>|null>(null);
    const [isSigningClientReady, setIsSigningClientReady] = useState(false);
    // Track which wallet instance was used to create the current client so we
    // recreate it when the user switches wallets (instead of a plain boolean
    // that permanently blocks re-initialization after the first load).
    const initializedForWallet = useRef<typeof wallet | null>(null);

    const createSigningClient = useCallback(async () => {
        return getSigningClient();
    }, [getSigningClient]);

    useEffect(() => {
        if (!wallet || !chain) {
            // Wallet disconnected (or switching) — clear stale client so the
            // next wallet gets a fresh one and the UI reflects disconnected state.
            if (initializedForWallet.current !== null) {
                setSigningClient(null);
                setIsSigningClientReady(false);
                initializedForWallet.current = null;
            }
            return;
        }
        // Same wallet object — client is already up-to-date, nothing to do.
        if (initializedForWallet.current === wallet) return;

        const load = async () => {
            const client = await createSigningClient();
            if (client) {
                registerBzeEncoders(client);
                setSigningClient(client);
                setIsSigningClientReady(true);
                initializedForWallet.current = wallet;
            }
        }

        load();
    }, [wallet, chain, createSigningClient]);

    return {
        signingClientError,
        signingClient,
        isSigningClientReady,
    }
};
