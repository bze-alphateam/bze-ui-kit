/**
 * Server-side Skip API proxy handler factory for Next.js App Router.
 *
 * Each consuming app creates a catch-all route at `src/app/api/skip/[...path]/route.ts`
 * and wires it with a one-liner:
 *
 * ```ts
 * import { createSkipProxyHandler } from '@bze/bze-ui-kit';
 * export const { GET, POST } = createSkipProxyHandler();
 * ```
 *
 * The handler forwards all requests to `https://api.skip.build`, injecting
 * the `SKIP_API_KEY` env var as an authorization header. This keeps the API
 * key server-side and avoids CORS issues from direct browser→Skip calls.
 */

const SKIP_API_BASE = 'https://api.skip.build';

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

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const apiKey = process.env.SKIP_API_KEY;
        if (apiKey) {
            headers['authorization'] = apiKey;
        }

        try {
            const fetchOptions: RequestInit = {
                method: req.method,
                headers,
            };

            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                fetchOptions.body = await req.text();
            }

            const response = await fetch(targetUrl, fetchOptions);
            const data = await response.text();

            return new Response(data, {
                status: response.status,
                headers: {
                    'Content-Type': response.headers.get('Content-Type') || 'application/json',
                },
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
