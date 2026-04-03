import type {
  AllowedAsset,
  RoutePreview,
  RoutePreviewFee,
  SkipMsg,
  SkipRouteResponse,
  TransferMechanism,
} from "../types/cross_chain";
import { uAmountToAmount } from "./amount";
import type { IBCData } from "../types/asset";
import { getChainByChainId } from "../constants/chain";

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

/**
 * Convert a Skip API message (JSON string with snake_case) to an EncodeObject
 * compatible with the signing client's signAndBroadcast().
 */
export const convertSkipMsgToEncodeObject = (skipMsg: SkipMsg): { typeUrl: string; value: unknown } => {
  const parsed = JSON.parse(skipMsg.msg);

  switch (skipMsg.msg_type_url) {
    case '/ibc.applications.transfer.v1.MsgTransfer':
      return {
        typeUrl: skipMsg.msg_type_url,
        value: {
          sourcePort: parsed.source_port,
          sourceChannel: parsed.source_channel,
          token: parsed.token,
          sender: parsed.sender,
          receiver: parsed.receiver,
          timeoutHeight: parsed.timeout_height ? {
            revisionNumber: BigInt(parsed.timeout_height.revision_number || '0'),
            revisionHeight: BigInt(parsed.timeout_height.revision_height || '0'),
          } : { revisionNumber: BigInt(0), revisionHeight: BigInt(0) },
          timeoutTimestamp: parsed.timeout_timestamp
            ? BigInt(parsed.timeout_timestamp)
            : BigInt(0),
          memo: parsed.memo || '',
        },
      };

    case '/cosmos.bank.v1beta1.MsgSend':
      return {
        typeUrl: skipMsg.msg_type_url,
        value: {
          fromAddress: parsed.from_address,
          toAddress: parsed.to_address,
          amount: parsed.amount,
        },
      };

    default:
      console.warn(`[convertSkipMsg] Unknown type: ${skipMsg.msg_type_url}, attempting pass-through`);
      return {
        typeUrl: skipMsg.msg_type_url,
        value: parsed,
      };
  }
};

/**
 * Resolve addresses for all chains in a Skip route's required_chain_addresses.
 * Returns undefined if any chain's address is missing.
 */
export const resolveAddressesForRoute = (
  requiredChainAddresses: string[],
  getAddress: (chainId: string) => string | undefined,
): string[] | undefined => {
  const addresses: string[] = [];
  for (const chainId of requiredChainAddresses) {
    const addr = getAddress(chainId);
    if (!addr) {
      console.error(`[resolveAddressesForRoute] Missing address for chain: ${chainId}`);
      return undefined;
    }
    addresses.push(addr);
  }
  return addresses;
};

/**
 * Map a Skip chain_id to a chain-registry chainName.
 */
export const chainIdToChainName = (chainId: string): string | undefined => {
  const chain = getChainByChainId(chainId);
  return chain?.chainName;
};
