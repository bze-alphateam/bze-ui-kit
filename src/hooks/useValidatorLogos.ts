import {useCallback, useEffect, useRef, useState} from 'react';

const KEYBASE_API_URL = 'https://keybase.io/_/api/1.0/user/lookup.json';
const LOGOS_STORAGE_KEY = 'validator_logos';
const LOGOS_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface ValidatorIdentity {
    operatorAddress: string;
    identity: string;
}

/**
 * Fetches validator logo URLs from Keybase using their identity field.
 * Results are cached in localStorage for 24 hours.
 *
 * @param validators - array of objects with operator_address and description.identity
 * @returns Record mapping operator_address to image URL (or empty string if none)
 */
export const useValidatorLogos = (
    validators: Array<{ operator_address: string; description?: { identity?: string } | null }>
): { logos: Record<string, string>; isLoading: boolean } => {
    const [logos, setLogos] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const fetchedRef = useRef(false);
    const validatorCountRef = useRef(0);

    const fetchLogos = useCallback(async (identities: ValidatorIdentity[]) => {
        if (identities.length === 0) return {};

        // Check cache
        let cached: Record<string, string> | null = null;
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(LOGOS_STORAGE_KEY) : null;
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && parsed.data && (!parsed.expiry || Date.now() < parsed.expiry)) {
                    cached = parsed.data;
                }
            }
        } catch { /* ignore */ }

        if (cached) {
            const allCached = identities.every(
                (v) => v.operatorAddress in cached!
            );
            if (allCached) {
                return cached;
            }
        }

        const result: Record<string, string> = cached ?? {};

        // Only fetch identities not already cached
        const toFetch = identities.filter((v) => !(v.operatorAddress in result));
        if (toFetch.length === 0) return result;

        // Chunk requests to avoid overwhelming the Keybase API
        const chunkSize = 20;
        for (let i = 0; i < toFetch.length; i += chunkSize) {
            const chunk = toFetch.slice(i, i + chunkSize);

            const chunkResults = await Promise.all(
                chunk.map(async ({operatorAddress, identity}) => {
                    if (!identity) {
                        return {operatorAddress, url: ''};
                    }
                    try {
                        const resp = await fetch(
                            `${KEYBASE_API_URL}?key_suffix=${encodeURIComponent(identity)}&fields=pictures`
                        );
                        const data = await resp.json();
                        const url = data?.them?.[0]?.pictures?.primary?.url ?? '';
                        return {operatorAddress, url};
                    } catch {
                        return {operatorAddress, url: ''};
                    }
                })
            );

            for (const {operatorAddress, url} of chunkResults) {
                result[operatorAddress] = url;
            }

            // Rate-limit between chunks
            if (i + chunkSize < toFetch.length) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }

        // Cache results
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(LOGOS_STORAGE_KEY, JSON.stringify({
                    data: result,
                    expiry: Date.now() + LOGOS_TTL,
                }));
            }
        } catch { /* ignore */ }

        return result;
    }, []);

    useEffect(() => {
        if (!validators || validators.length === 0) return;
        // Only re-fetch if validators list changed size (avoids repeated fetches on re-renders)
        if (fetchedRef.current && validatorCountRef.current === validators.length) return;

        const identities: ValidatorIdentity[] = validators.map((v) => ({
            operatorAddress: v.operator_address,
            identity: v.description?.identity ?? '',
        }));

        setIsLoading(true);
        fetchedRef.current = true;
        validatorCountRef.current = validators.length;

        fetchLogos(identities)
            .then((result) => {
                setLogos(result);
            })
            .catch(console.error)
            .finally(() => {
                setIsLoading(false);
            });
    }, [validators, fetchLogos]);

    return {logos, isLoading};
};
