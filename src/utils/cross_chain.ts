import type {
  AllowedAsset,
  RoutePreview,
  RoutePreviewFee,
  SkipRouteResponse,
  TransferMechanism,
} from "../types/cross_chain";
import { uAmountToAmount } from "./amount";
import type { IBCData } from "../types/asset";

/**
 * Build a UI-friendly route preview from a Skip API route response.
 */
export const buildRoutePreview = (
  route: SkipRouteResponse,
  destAsset: AllowedAsset,
  mechanism: TransferMechanism,
): RoutePreview => {
  const fees: RoutePreviewFee[] = (route.estimated_fees || []).map(fee => ({
    amount: fee.amount,
    ticker: fee.origin_asset.denom,
    usdValue: fee.usd_amount,
  }));

  return {
    estimatedOutput: uAmountToAmount(route.amount_out, destAsset.decimals),
    estimatedOutputTicker: destAsset.ticker,
    estimatedDurationSeconds: route.estimated_route_duration_seconds,
    fees,
    txsRequired: route.txs_required,
    mechanism,
    warning: route.warning?.message,
    rawRoute: route,
  };
};

/**
 * Build a route preview for pure IBC transfers (no Skip API needed).
 * Direct transfer: output = input, no fees, ~30 sec.
 */
export const buildIbcRoutePreview = (
  amount: string,
  asset: AllowedAsset,
): RoutePreview => {
  return {
    estimatedOutput: amount,
    estimatedOutputTicker: asset.ticker,
    estimatedDurationSeconds: 30,
    fees: [],
    txsRequired: 1,
    mechanism: 'ibc',
    warning: undefined,
    rawRoute: undefined,
  };
};

/**
 * Format a duration in seconds to a human-readable string.
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `~${seconds}s`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`;
  return `~${Math.ceil(seconds / 3600)}h`;
};

/**
 * Find IBCData for a specific counterparty chain from the ibcChains list.
 * Used for pure IBC transfers to resolve channel IDs.
 */
export const findIbcDataForChain = (
  ibcChains: IBCData[],
  chainName: string,
): IBCData | undefined => {
  return ibcChains.find(ibc => ibc.counterparty.chainName === chainName);
};

/**
 * Generate a unique ID for transaction history records.
 */
export const generateTxRecordId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};
