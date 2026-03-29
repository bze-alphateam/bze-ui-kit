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
    const hasInitialized = useRef(false);

    const createSigningClient = useCallback(async () => {
        return getSigningClient();
    }, [getSigningClient]);

    useEffect(() => {
        if (!wallet || !chain || hasInitialized.current) {
            return
        }

        const load = async () => {
            const client = await createSigningClient();
            if (client) {
                registerBzeEncoders(client);
                setSigningClient(client);
                setIsSigningClientReady(true);
                hasInitialized.current = true;
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
