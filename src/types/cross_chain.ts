// ─── Allowlist Configuration Types ───

export interface AllowedChain {
  chainName: string;           // chain-registry name (e.g., "noble", "osmosis", "atomone")
  displayName: string;         // User-friendly name (e.g., "Noble", "Osmosis", "AtomOne")
  logo: string;                // URL to chain logo
  addressPrefix: string;       // Bech32 prefix (e.g., "noble", "osmo") or "0x" for EVM
  skipChainId: string;         // Skip API chain ID (e.g., "noble-1"). Empty string if not on Skip.
  isEvm: boolean;              // Whether this is an EVM chain
  evmChainId?: number;         // EVM chain ID (e.g., 1 for Ethereum). Only set when isEvm=true.
  hasDirectIbc: boolean;       // Whether BZE has a direct IBC connection to this chain
  assets: AllowedAsset[];      // Permitted assets on this chain
}

export interface AllowedAsset {
  sourceDenom: string;         // Denom on source chain (e.g., "uusdc" on Noble, "uosmo" on Osmosis)
  displayName: string;         // User-friendly name (e.g., "USD Coin")
  ticker: string;              // Short ticker (e.g., "USDC", "OSMO")
  logo: string;                // URL to asset logo
  decimals: number;            // Exponent (e.g., 6 for USDC, 18 for ETH)
  bzeDenom: string;            // IBC denom on BZE chain (e.g., "ibc/6490A7..."). Empty if no direct representation.
  skipDenom?: string;          // Override denom for Skip API queries (if different from sourceDenom)
}

// ─── Transfer Flow Types ───

export type TransferDirection = 'deposit' | 'withdraw';
export type TransferMechanism = 'ibc' | 'skip';

export interface CrossChainTransferRequest {
  direction: TransferDirection;
  sourceChain: AllowedChain;
  destChain: AllowedChain;     // For deposit: BZE is dest. For withdraw: BZE is source.
  asset: AllowedAsset;
  amount: string;              // Human-readable amount (e.g., "100.5")
  sourceAddress: string;
  destAddress: string;
  mechanism: TransferMechanism;
}

// ─── Route Preview (UI-friendly) ───

export interface RoutePreview {
  estimatedOutput: string;            // Human-readable output amount
  estimatedOutputTicker: string;      // Output asset ticker
  estimatedDurationSeconds: number;
  fees: RoutePreviewFee[];
  txsRequired: number;
  mechanism: TransferMechanism;
  warning?: string;                   // Price impact or safety warning
  rawRoute?: SkipRouteResponse;       // Original Skip response (for building msgs later)
}

export interface RoutePreviewFee {
  amount: string;
  ticker: string;
  usdValue?: string;
}

// ─── Skip API Types ───

export interface SkipRouteRequest {
  source_asset_denom: string;
  source_asset_chain_id: string;
  dest_asset_denom: string;
  dest_asset_chain_id: string;
  amount_in?: string;                 // Mutually exclusive with amount_out
  amount_out?: string;
  smart_relay?: boolean;
  allow_multi_tx?: boolean;
  allow_unsafe?: boolean;
  bridges?: string[];                 // e.g., ["IBC", "CCTP", "AXELAR"]
  allow_swaps?: boolean;
  cumulative_affiliate_fee_bps?: string;
}

export interface SkipRouteResponse {
  amount_in: string;
  amount_out: string;
  source_asset_denom: string;
  source_asset_chain_id: string;
  dest_asset_denom: string;
  dest_asset_chain_id: string;
  operations: SkipOperation[];
  chain_ids: string[];
  required_chain_addresses: string[];
  txs_required: number;
  estimated_route_duration_seconds: number;
  does_swap: boolean;
  usd_amount_in?: string;
  usd_amount_out?: string;
  swap_price_impact_percent?: string;
  estimated_fees?: SkipEstimatedFee[];
  warning?: SkipRouteWarning;
}

export interface SkipOperation {
  // Skip operations are polymorphic - we store them as-is for passing back to /msgs
  [key: string]: unknown;
}

export interface SkipEstimatedFee {
  fee_type: string;
  bridge_id: string;
  amount: string;
  usd_amount?: string;
  origin_asset: { denom: string; chain_id: string };
  chain_id: string;
  tx_index: number;
}

export interface SkipRouteWarning {
  type: string;
  message: string;
}

export interface SkipMsgsRequest {
  source_asset_denom: string;
  source_asset_chain_id: string;
  dest_asset_denom: string;
  dest_asset_chain_id: string;
  amount_in: string;
  amount_out: string;
  address_list: string[];
  operations: SkipOperation[];
  slippage_tolerance_percent?: string;
  timeout_seconds?: number;
}

export interface SkipMsgsResponse {
  txs: SkipTx[];
  estimated_fees?: SkipEstimatedFee[];
}

export interface SkipTx {
  chain_id: string;
  path: string;
  msgs: SkipMsg[];
  signer_address: string;
  operations_indices: number[];
}

export interface SkipMsg {
  msg_type_url: string;
  msg: string;                        // JSON-encoded message body
  evm_tx?: SkipEvmTx;                 // Only present for EVM transactions
}

export interface SkipEvmTx {
  to: string;
  value: string;
  data: string;
  chain_id: string;
  required_erc20_approvals?: SkipErc20Approval[];
}

export interface SkipErc20Approval {
  token_contract: string;
  spender: string;
  amount: string;
}

// ─── Transaction Status Tracking ───

export interface SkipTxStatusRequest {
  tx_hash: string;
  chain_id: string;
}

export interface SkipTxStatusResponse {
  state: SkipTxState;
  transfers: SkipTransferStatus[];
  transfer_asset_release?: {
    chain_id: string;
    denom: string;
    amount: string;
    released: boolean;
  };
  error?: {
    message: string;
    type: string;
  };
}

export type SkipTxState =
  | 'STATE_SUBMITTED'
  | 'STATE_PENDING'
  | 'STATE_COMPLETED_SUCCESS'
  | 'STATE_COMPLETED_ERROR'
  | 'STATE_ABANDONED';

export interface SkipTransferStatus {
  state: string;
  transfer_sequence: SkipTransferEvent[];
  next_blocking_transfer_index?: number;
}

export interface SkipTransferEvent {
  ibc_transfer?: {
    src_chain_id: string;
    dst_chain_id: string;
    state: string;
    packet_txs: {
      send_tx?: { chain_id: string; tx_hash: string; explorer_link?: string };
      receive_tx?: { chain_id: string; tx_hash: string; explorer_link?: string };
      acknowledge_tx?: { chain_id: string; tx_hash: string; explorer_link?: string };
    };
  };
  axelar_transfer?: Record<string, unknown>;
  cctp_transfer?: Record<string, unknown>;
}

// ─── Local Transaction History ───

export type CrossChainTxState = 'signing' | 'broadcasting' | 'submitted' | 'pending' | 'completed' | 'failed' | 'abandoned';

export interface CrossChainTxRecord {
  id: string;                          // Generated unique ID
  timestamp: number;                   // Date.now() when created
  direction: TransferDirection;
  sourceChainName: string;
  destChainName: string;
  assetTicker: string;
  amountIn: string;                    // Human-readable
  estimatedAmountOut: string;          // Human-readable
  mechanism: TransferMechanism;
  state: CrossChainTxState;
  txHash?: string;
  broadcastChainId?: string;           // Chain where the tx was broadcast (for status polling)
  error?: string;
}

// ─── Skip Chain & Asset Types (from API responses) ───

export interface SkipChain {
  chain_name: string;
  chain_id: string;
  pfm_enabled: boolean;
  supports_memo: boolean;
  logo_uri?: string;
  chain_type: string;
  is_testnet: boolean;
}

export interface SkipAsset {
  denom: string;
  chain_id: string;
  origin_denom: string;
  origin_chain_id: string;
  symbol?: string;
  name?: string;
  logo_uri?: string;
  decimals?: number;
  is_cw20: boolean;
  is_evm: boolean;
  is_svm: boolean;
  coingecko_id?: string;
}
