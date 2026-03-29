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
    const {getSigningClient, signingClientError, wallet, chain, address} = useChain(chainName ?? getChainName());
    const [signingClient, setSigningClient] = useState<Awaited<ReturnType<typeof getSigningClient>>|null>(null);
    const [isSigningClientReady, setIsSigningClientReady] = useState(false);
    // Track the address the current client was built for. Switching accounts
    // within the same wallet extension (e.g. Keplr) keeps `wallet` the same
    // but changes `address`, so this is the reliable signal to recreate.
    const initializedForAddress = useRef<string | null>(null);

    const createSigningClient = useCallback(async () => {
        return getSigningClient();
    }, [getSigningClient]);

    useEffect(() => {
        if (!wallet || !chain || !address) {
            // Wallet disconnected (or switching) — clear stale client so the
            // next connection starts fresh and the UI reflects disconnected state.
            if (initializedForAddress.current !== null) {
                setSigningClient(null);
                setIsSigningClientReady(false);
                initializedForAddress.current = null;
            }
            return;
        }
        // Same address — client is already up-to-date, nothing to do.
        if (initializedForAddress.current === address) return;

        const load = async () => {
            const client = await createSigningClient();
            if (client) {
                registerBzeEncoders(client);
                setSigningClient(client);
                setIsSigningClientReady(true);
                initializedForAddress.current = address;
            }
        }

        load();
    }, [wallet, chain, address, createSigningClient]);

    return {
        signingClientError,
        signingClient,
        isSigningClientReady,
    }
};
