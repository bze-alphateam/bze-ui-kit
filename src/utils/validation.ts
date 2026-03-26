import { ValidationResult } from '../types/settings'
import { VALIDATION_ERRORS } from '../constants/settings'
import {getBurnerParamsWithClient} from "../query/burner";
import {createRestClient} from "../query/client";

function isValidUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString)
        return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ws:' || url.protocol === 'wss:'
    } catch {
        return false
    }
}

export async function validateRestEndpoint(endpoint: string): Promise<ValidationResult> {
    if (!endpoint.trim()) {
        return { isValid: false, error: VALIDATION_ERRORS.EMPTY_ENDPOINT }
    }

    if (!isValidUrl(endpoint)) {
        return { isValid: false, error: VALIDATION_ERRORS.INVALID_URL }
    }

    const url = new URL(endpoint)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { isValid: false, error: VALIDATION_ERRORS.INVALID_REST_PROTOCOL }
    }

    try {
        const client = await createRestClient(endpoint)
        const params = await getBurnerParamsWithClient(client)
        if (params) {
            return { isValid: true }
        }

        return { isValid: false, error: VALIDATION_ERRORS.CORS_ERROR }
    } catch (error) {
        console.error(error)
        return { isValid: false, error: VALIDATION_ERRORS.NETWORK_ERROR }
    }
}

export async function validateRpcEndpoint(endpoint: string): Promise<ValidationResult> {
    if (!endpoint.trim()) {
        return { isValid: false, error: VALIDATION_ERRORS.EMPTY_ENDPOINT }
    }

    if (!isValidUrl(endpoint)) {
        return { isValid: false, error: VALIDATION_ERRORS.INVALID_URL }
    }

    const wsEndpoint = convertToWebSocketUrl(endpoint);
    const url = new URL(wsEndpoint);

    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
        return { isValid: false, error: VALIDATION_ERRORS.INVALID_RPC_PROTOCOL }
    }

    try {
        const isConnectable = await testWebSocketConnection(wsEndpoint);

        if (isConnectable) {
            return { isValid: true };
        } else {
            return { isValid: false, error: VALIDATION_ERRORS.WEBSOCKET_ERROR };
        }
    } catch (error) {
        console.error('WebSocket validation error:', error);
        return { isValid: false, error: VALIDATION_ERRORS.NETWORK_ERROR };
    }
}

function testWebSocketConnection(endpoint: string): Promise<boolean> {
    return new Promise((resolve) => {
        const ws = new WebSocket(`${endpoint}/websocket`);
        const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
        }, 5000);

        ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(true);
        };

        ws.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
        };

        ws.onclose = (event) => {
            clearTimeout(timeout);
            if (event.wasClean) {
                resolve(true);
            }
        };
    });
}

export async function validateEndpoints(restEndpoint: string, rpcEndpoint: string) {
    const [restResult, rpcResult] = await Promise.all([
        validateRestEndpoint(restEndpoint),
        validateRpcEndpoint(rpcEndpoint)
    ])

    return {
        rest: restResult,
        rpc: rpcResult,
        isValid: restResult.isValid && rpcResult.isValid
    }
}

export function convertToWebSocketUrl(url: string): string {
    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.protocol === 'http:') {
            parsedUrl.protocol = 'ws:';
        } else if (parsedUrl.protocol === 'https:') {
            parsedUrl.protocol = 'wss:';
        }

        return parsedUrl.toString();
    } catch (error) {
        console.warn('Failed to parse URL for WebSocket conversion:', error);
        return url;
    }
}
