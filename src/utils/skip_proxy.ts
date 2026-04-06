/**
 * Server-side Skip API proxy handler factory for Next.js App Router.
 *
 * Each consuming app creates a catch-all route at `src/app/api/skip/[...path]/route.ts`
 * and wires it with a one-liner:
 *
 * ```ts
 * import { createSkipProxyHandler } from '@bze/bze-ui-kit/server';
 * export const { GET, POST } = createSkipProxyHandler();
 * ```
 *
 * The handler forwards requests to `https://api.skip.build`, injecting the
 * `SKIP_API_KEY` env var as an authorization header. Responses for stable
 * endpoints (chains, assets, routes) are cached in-memory on the server so
 * repeated calls from the same or different users are served instantly.
 */

const SKIP_API_BASE = 'https://api.skip.build';

// ─── In-memory server cache ────────────────────────────────────────────────

interface CacheEntry {
    data: string;
    contentType: string;
    status: number;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Evict expired entries. Called lazily on each request. */
const evictExpired = () => {
    const now = Date.now();
    for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(key);
    }
};

/**
 * Cache TTL rules per endpoint path pattern. Endpoints not listed here
 * are never cached (msgs, tx/status).
 */
const getCacheTtlMs = (path: string, method: string): number => {
    // GET /v2/info/chains — chain list, very stable
    if (method === 'GET' && path.includes('info/chains')) return 15 * 60 * 1000;

    // GET /v2/fungible/assets — per-chain asset catalog
    if (method === 'GET' && path.includes('fungible/assets')) return 10 * 60 * 1000;

    // POST /v2/fungible/route — prices shift but same pair+amount is stable briefly
    if (method === 'POST' && path.includes('fungible/route')) return 30 * 1000;

    // Everything else: no cache (msgs, tx/status, unknown endpoints)
    return 0;
};

/** Build a cache key from method + URL + body (for POSTs). */
const buildCacheKey = (method: string, url: string, body?: string): string => {
    if (body) return `${method}:${url}:${body}`;
    return `${method}:${url}`;
};

// ─── Handler factory ───────────────────────────────────────────────────────

interface SkipProxyOptions {
    /** Override the Skip API base URL (default: https://api.skip.build) */
    baseUrl?: string;
}

export function createSkipProxyHandler(options?: SkipProxyOptions) {
    const baseUrl = (options?.baseUrl ?? SKIP_API_BASE).replace(/\/$/, '');

    const handler = async (
        req: Request,
        context: { params: Promise<{ path: string[] }> | { path: string[] } },
    ): Promise<Response> => {
        const params = await context.params;
        const path = params.path.join('/');
        const url = new URL(req.url);
        const targetUrl = `${baseUrl}/${path}${url.search}`;
        const method = req.method;

        // Read body for POST/PUT/PATCH (needed both for cache key and forwarding)
        let body: string | undefined;
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            body = await req.text();
        }

        const ttl = getCacheTtlMs(path, method);

        // ── Check cache ────────────────────────────────────────────────
        if (ttl > 0) {
            evictExpired();
            const cacheKey = buildCacheKey(method, targetUrl, body);
            const cached = cache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return new Response(cached.data, {
                    status: cached.status,
                    headers: {'Content-Type': cached.contentType},
                });
            }
        }

        // ── Forward to Skip ────────────────────────────────────────────
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        const apiKey = process.env.SKIP_API_KEY;
        if (apiKey) {
            headers['authorization'] = apiKey;
        }

        try {
            const fetchOptions: RequestInit = {method, headers};
            if (body) fetchOptions.body = body;

            const response = await fetch(targetUrl, fetchOptions);
            const data = await response.text();
            const contentType = response.headers.get('Content-Type') || 'application/json';

            // ── Store in cache (only successful responses) ─────────────
            if (ttl > 0 && response.ok) {
                const cacheKey = buildCacheKey(method, targetUrl, body);
                cache.set(cacheKey, {
                    data,
                    contentType,
                    status: response.status,
                    expiresAt: Date.now() + ttl,
                });
            }

            return new Response(data, {
                status: response.status,
                headers: {'Content-Type': contentType},
            });
        } catch (error) {
            console.error('[skip-proxy] error:', error);
            return new Response(
                JSON.stringify({error: 'Skip API proxy error'}),
                {status: 502, headers: {'Content-Type': 'application/json'}},
            );
        }
    };

    return {
        GET: handler,
        POST: handler,
    };
}
