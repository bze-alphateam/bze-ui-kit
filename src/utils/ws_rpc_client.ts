/**
 * Shared WebSocket singleton for CometBFT event subscriptions.
 *
 * One persistent connection is reused across all callers (useBlockchainListener,
 * etc.) so the app opens a single WebSocket to the RPC node instead of one
 * per hook instance.
 *
 * CometBFT sends subscription notifications by reusing the original request ID
 * (not the Ethereum-style params.subscription pattern), so we track active
 * subscriptions by their call ID and dispatch incoming messages accordingly.
 */

type EventSubscription = {
    query: string;
    handler: (result: unknown) => void;
};

// ── Singleton state ──────────────────────────────────────────────────────────
let socket: WebSocket | null = null;
let activeUrl: string = '';
let socketConnected = false;
let connectingPromise: Promise<void> | null = null;
let msgId = 0;
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

const MAX_RECONNECT_ATTEMPTS = 10;

const activeSubscriptions = new Map<string, EventSubscription>();
// ────────────────────────────────────────────────────────────────────────────

const handleMessage = (event: MessageEvent) => {
    try {
        const msg = JSON.parse(event.data as string);
        const id = String(msg?.id ?? '');

        // CometBFT subscription notification: same id as the subscribe call,
        // non-empty result object (the empty {} ack is ignored here).
        if (id && activeSubscriptions.has(id) && msg.result && Object.keys(msg.result).length > 0) {
            activeSubscriptions.get(id)!.handler(msg.result);
        }
    } catch {}
};

const resubscribeAll = () => {
    for (const [id, sub] of activeSubscriptions) {
        socket!.send(JSON.stringify({
            jsonrpc: '2.0',
            method: 'subscribe',
            id,
            params: {query: sub.query},
        }));
    }
};

const scheduleReconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WS] Max reconnect attempts reached');
        return;
    }
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30_000);
    reconnectTimeout = setTimeout(async () => {
        try {
            await openSocket(activeUrl);
            resubscribeAll();
            reconnectAttempts = 0;
        } catch {
            scheduleReconnect();
        }
    }, delay);
};

const openSocket = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);

        ws.onopen = () => {
            socket = ws;
            socketConnected = true;
            resolve();
        };

        ws.onmessage = handleMessage;

        ws.onclose = () => {
            socketConnected = false;
            scheduleReconnect();
        };

        ws.onerror = (err) => {
            socketConnected = false;
            reject(err);
        };
    });
};

const getOrCreateSocket = async (rpcEndpoint: string): Promise<void> => {
    const url = rpcEndpoint.replace(/\/?$/, '') + '/websocket';
    if (socket && socketConnected && activeUrl === url) return;

    // If a connection attempt is already in flight for this URL, wait on it
    // instead of opening a second socket (concurrent callers race condition).
    if (connectingPromise && activeUrl === url) {
        return connectingPromise;
    }

    // Endpoint changed — tear down cleanly without triggering reconnect
    if (socket) {
        socket.onclose = null;
        socket.close(1000, 'Endpoint changed');
        socket = null;
        socketConnected = false;
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        reconnectAttempts = 0;
    }

    activeUrl = url;
    connectingPromise = openSocket(url).finally(() => {
        connectingPromise = null;
    });
    return connectingPromise;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Subscribes to CometBFT events using the shared WebSocket connection.
 * The handler receives `msg.result` for every notification:
 *   result.data.value.result_finalize_block.events  — NewBlock events
 *   result.data.value.txs_results                   — block Tx results
 *   result.data.value.TxResult.result.events        — Tx subscription events
 *
 * Returns an unsubscribe function that cleans up the subscription.
 * Active subscriptions are automatically resubscribed after reconnection.
 */
export const subscribeToBlockchainEvents = async (
    rpcEndpoint: string,
    query: string,
    handler: (result: unknown) => void,
): Promise<() => void> => {
    await getOrCreateSocket(rpcEndpoint);
    const id = String(++msgId);
    activeSubscriptions.set(id, {query, handler});
    socket!.send(JSON.stringify({jsonrpc: '2.0', method: 'subscribe', id, params: {query}}));

    return () => {
        activeSubscriptions.delete(id);
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                jsonrpc: '2.0',
                method: 'unsubscribe',
                id: String(++msgId),
                params: {query},
            }));
        }
    };
};
