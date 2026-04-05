'use client'

import {useCallback, useEffect, useState} from "react";
import BigNumber from "bignumber.js";
import {getChainRestURL} from "../constants/endpoints";

export type CounterpartyBalanceStatus =
    | 'idle'          // nothing to fetch yet (missing inputs)
    | 'loading'
    | 'ready'         // balance fetched successfully (may be zero)
    | 'unsupported'   // no REST endpoint available for this chain
    | 'error';        // endpoint exists but call failed

export interface UseCounterpartyBalanceResult {
    amount: BigNumber;     // raw uAmount (integer)
    status: CounterpartyBalanceStatus;
    refetch: () => void;
}

/**
 * Fetch the balance of a given denom on a foreign Cosmos chain by calling the
 * REST endpoint's `/cosmos/bank/v1beta1/balances/{address}/by_denom?denom=…`.
 *
 * Resolution order for the REST URL:
 *   1. Per-chain env var (e.g. NEXT_PUBLIC_REST_URL_NOBLE)
 *   2. chain-registry default REST endpoint
 * If neither is usable, returns status `unsupported` — the UI should surface
 * a friendly "we can't see your balance on X" hint.
 */
export function useCounterpartyBalance(
    chainName: string | undefined,
    address: string | undefined,
    denom: string | undefined,
): UseCounterpartyBalanceResult {
    const [amount, setAmount] = useState<BigNumber>(new BigNumber(0));
    const [status, setStatus] = useState<CounterpartyBalanceStatus>('idle');
    const [tick, setTick] = useState(0);

    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        if (!chainName || !address || !denom) {
            setStatus('idle');
            setAmount(new BigNumber(0));
            return;
        }

        const restUrl = getChainRestURL(chainName);
        if (!restUrl) {
            setStatus('unsupported');
            setAmount(new BigNumber(0));
            return;
        }

        let cancelled = false;
        setStatus('loading');

        const url = `${restUrl}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${encodeURIComponent(denom)}`;
        fetch(url)
            .then(async (res) => {
                if (!res.ok) throw new Error(`REST ${res.status}`);
                return res.json();
            })
            .then((data: { balance?: { amount?: string; denom?: string } }) => {
                if (cancelled) return;
                const raw = data?.balance?.amount ?? '0';
                setAmount(new BigNumber(raw));
                setStatus('ready');
            })
            .catch((e) => {
                if (cancelled) return;
                console.error(`[useCounterpartyBalance] ${chainName}:`, e);
                setAmount(new BigNumber(0));
                setStatus('error');
            });

        return () => {
            cancelled = true;
        };
    }, [chainName, address, denom, tick]);

    return {amount, status, refetch};
}
