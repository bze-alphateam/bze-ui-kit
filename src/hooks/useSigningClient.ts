import {
    getSigningBzeClient,
    getSigningCosmosClient,
    getSigningIbcClient
} from "@bze/bzejs";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useChain} from "@interchain-kit/react";
import {getChainName} from "../constants/chain";
import {
    getArchwayRpcURL, getAtomOneRpcUrl,
    getJackalRpcUrl,
    getNobleRpcUrl,
    getOmniFlixRpcUrl,
    getOsmosisRpcUrl,
} from "../constants/endpoints";
import {useSettings} from "./useSettings";

interface UseSigningClientProps {
    chainName?: string;
    isIbc?: boolean;
    isCosmos?: boolean;
}

export const useSigningClient = ({chainName, isIbc, isCosmos}: UseSigningClientProps ): {
    signingClientError: unknown;
    signingClient: unknown;
    isSigningClientReady: boolean;
} => {
    const {getSigningClient, signingClientError, wallet, chain} = useChain(chainName ?? getChainName());
    const [signingClient, setSigningClient] = useState<Awaited<ReturnType<typeof getSigningClient>>|null>(null);
    const [isSigningClientReady, setIsSigningClientReady] = useState(false);
    const {settings} = useSettings()
    const hasInitialized = useRef(false);

    const defaultChainName = useMemo(() => getChainName(), []);

    const createSigningClient = useCallback(async () => {
        const signingResult = await getSigningClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const offlineSigner = (signingResult as any)?.offlineSigner;
        const rpcEndpoint = settings.endpoints.rpcEndpoint.replace("wss://", "https://").replace("ws://", "http://")
        if (!offlineSigner) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let clientFn: any = getSigningBzeClient
        if (isIbc) {
            clientFn = getSigningIbcClient
        } else if (isCosmos) {
            clientFn = getSigningCosmosClient
        }

        const signer = offlineSigner?.offlineSigner ?? offlineSigner;

        const getRpcForChain = (name: string | undefined): string => {
            switch (name) {
                case 'archway': return getArchwayRpcURL();
                case 'osmosis': return getOsmosisRpcUrl();
                case 'noble': return getNobleRpcUrl();
                case 'jackal': return getJackalRpcUrl();
                case 'omniflixhub': return getOmniFlixRpcUrl();
                case 'atomone': return getAtomOneRpcUrl();
                default: return rpcEndpoint;
            }
        }

        const endpoint = chainName && chainName !== defaultChainName
            ? getRpcForChain(chainName)
            : rpcEndpoint;

        return clientFn({rpcEndpoint: endpoint, signer: signer});
    }, [getSigningClient, settings.endpoints.rpcEndpoint, isIbc, isCosmos, chainName, defaultChainName]);

    useEffect(() => {
        if (!wallet || !chain || hasInitialized.current) {
            return
        }

        const load = async () => {
            const client = await createSigningClient();
            if (client) {
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
