/**
 * Session-scoped REST endpoint health checker.
 *
 * Cosmos chain-registry ships a community-maintained list of REST endpoints
 * per chain (`apis.rest[]`) but provides no liveness signal — entries can be
 * stale at any moment. When we don't have an env-provided endpoint for a
 * given chain, we have to pick a healthy one ourselves.
 *
 * Strategy:
 *   1. Probe each candidate URL with `GET /cosmos/base/tendermint/v1beta1/node_info`
 *      (cheap, CORS-friendly, returns in one RTT) under a short timeout.
 *   2. First responder wins — no ranking, no aggregate scoring. We're not
 *      picking the fastest endpoint, just a reachable one.
 *   3. Cache the winner for the rest of the session, keyed by chain name.
 *      We only re-probe on explicit invalidation (e.g. after a fetch failure).
 *
 * This is intentionally kept tiny and side-effect free — it never throws and
 * always resolves to a URL or empty string.
 */

const CACHE = new Map<string, string>();   // chainName -> winning REST URL
const INFLIGHT = new Map<string, Promise<string>>();

const PROBE_PATH = '/cosmos/base/tendermint/v1beta1/node_info';
const PROBE_TIMEOUT_MS = 2500;

const stripTrailingSlash = (url: string): string => url.replace(/\/$/, '');

/**
 * Probe a single URL. Resolves with the URL if the node_info endpoint
 * returned a 2xx within the timeout, otherwise with an empty string.
 */
const probeOne = async (url: string): Promise<string> => {
    const base = stripTrailingSlash(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const res = await fetch(`${base}${PROBE_PATH}`, {
            signal: controller.signal,
            // We only need the status code; avoid pulling a response body
            // through CORS if we don't have to.
            method: 'GET',
        });
        if (res.ok) return base;
    } catch {
        // swallow — we'll just return empty
    } finally {
        clearTimeout(timeout);
    }
    return '';
};

/**
 * Try each candidate URL in order; resolve with the first that succeeds.
 * Sequential probing keeps us off flaky endpoints quickly and avoids fanning
 * out a bunch of concurrent requests that we'd immediately throw away.
 */
const probeSequential = async (candidates: string[]): Promise<string> => {
    for (const url of candidates) {
        if (!url) continue;
        const winner = await probeOne(url);
        if (winner) return winner;
    }
    return '';
};

/**
 * Return a healthy REST URL for the given chain, picking from `candidates`
 * in order. Result is cached for the session. Concurrent calls for the same
 * chain share a single in-flight probe.
 *
 * Returns an empty string when nothing works.
 */
export const resolveHealthyRestUrl = async (
    chainName: string,
    candidates: string[],
): Promise<string> => {
    const cached = CACHE.get(chainName);
    if (cached !== undefined) return cached;

    const existing = INFLIGHT.get(chainName);
    if (existing) return existing;

    const probe = probeSequential(candidates).then(url => {
        CACHE.set(chainName, url);
        INFLIGHT.delete(chainName);
        return url;
    });
    INFLIGHT.set(chainName, probe);
    return probe;
};

/**
 * Drop the cached endpoint for a chain so the next call re-probes. Used when
 * a downstream fetch fails against a previously healthy URL (the endpoint
 * died mid-session).
 */
export const invalidateHealthyRestUrl = (chainName: string): void => {
    CACHE.delete(chainName);
    INFLIGHT.delete(chainName);
};

/**
 * Direct synchronous cache read. Mainly for tests + debug.
 */
export const getCachedRestUrl = (chainName: string): string | undefined => {
    return CACHE.get(chainName);
};
