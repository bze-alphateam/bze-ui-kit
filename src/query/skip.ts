import type {
  SkipChain,
  SkipAsset,
  SkipRouteRequest,
  SkipRouteResponse,
  SkipMsgsRequest,
  SkipMsgsResponse,
  SkipTxStatusRequest,
  SkipTxStatusResponse,
} from "../types/cross_chain";
import { getSkipProxyUrl } from "../constants/cross_chain";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";

const CHAINS_CACHE_KEY = 'skip:chains';
const ASSETS_CACHE_KEY_PREFIX = 'skip:assets:';
const CACHE_TTL = 5 * 60; // 5 minutes

const skipFetch = async (path: string, options?: RequestInit): Promise<Response> => {
  const baseUrl = getSkipProxyUrl();
  const url = `${baseUrl}/${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
};

/**
 * GET /v2/info/chains — Retrieve all supported chains.
 * Cached for 5 minutes.
 */
export const skipGetChains = async (): Promise<SkipChain[]> => {
  const cached = getFromLocalStorage(CHAINS_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const resp = await skipFetch('v2/info/chains');
    if (!resp.ok) {
      console.error('[Skip] failed to fetch chains, status:', resp.status);
      return [];
    }
    const json = await resp.json();
    const chains: SkipChain[] = json.chains || [];
    setInLocalStorage(CHAINS_CACHE_KEY, JSON.stringify(chains), CACHE_TTL);
    return chains;
  } catch (e) {
    console.error('[Skip] failed to fetch chains:', e);
    return [];
  }
};

/**
 * GET /v2/fungible/assets?chain_id={chainId} — Assets on a specific chain.
 * Cached for 5 minutes per chain.
 */
export const skipGetAssets = async (chainId: string): Promise<SkipAsset[]> => {
  const cacheKey = `${ASSETS_CACHE_KEY_PREFIX}${chainId}`;
  const cached = getFromLocalStorage(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const resp = await skipFetch(`v2/fungible/assets?chain_id=${encodeURIComponent(chainId)}`);
    if (!resp.ok) {
      console.error('[Skip] failed to fetch assets, status:', resp.status);
      return [];
    }
    const json = await resp.json();
    // Response is { chain_to_assets_map: { [chainId]: { assets: SkipAsset[] } } }
    const chainAssets = json.chain_to_assets_map?.[chainId]?.assets || [];
    setInLocalStorage(cacheKey, JSON.stringify(chainAssets), CACHE_TTL);
    return chainAssets;
  } catch (e) {
    console.error('[Skip] failed to fetch assets:', e);
    return [];
  }
};

/**
 * POST /v2/fungible/route — Get route for a cross-chain transfer.
 * Always enables smart_relay. Never cached.
 */
export const skipGetRoute = async (request: SkipRouteRequest): Promise<SkipRouteResponse | undefined> => {
  try {
    const body = {
      ...request,
      smart_relay: true,
      allow_swaps: request.allow_swaps ?? true,
    };
    const resp = await skipFetch('v2/fungible/route', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[Skip] route failed, status:', resp.status, errBody);
      return undefined;
    }
    return await resp.json();
  } catch (e) {
    console.error('[Skip] failed to get route:', e);
    return undefined;
  }
};

/**
 * POST /v2/fungible/msgs — Get ready-to-sign messages for a route.
 * Never cached.
 */
export const skipGetMsgs = async (request: SkipMsgsRequest): Promise<SkipMsgsResponse | undefined> => {
  try {
    const resp = await skipFetch('v2/fungible/msgs', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[Skip] msgs failed, status:', resp.status, errBody);
      return undefined;
    }
    return await resp.json();
  } catch (e) {
    console.error('[Skip] failed to get msgs:', e);
    return undefined;
  }
};

/**
 * GET /v2/tx/status — Poll transaction status.
 * Never cached.
 */
export const skipGetTxStatus = async (request: SkipTxStatusRequest): Promise<SkipTxStatusResponse | undefined> => {
  try {
    const params = new URLSearchParams({
      tx_hash: request.tx_hash,
      chain_id: request.chain_id,
    });
    const resp = await skipFetch(`v2/tx/status?${params.toString()}`);
    if (!resp.ok) {
      console.error('[Skip] tx status failed, status:', resp.status);
      return undefined;
    }
    return await resp.json();
  } catch (e) {
    console.error('[Skip] failed to get tx status:', e);
    return undefined;
  }
};
