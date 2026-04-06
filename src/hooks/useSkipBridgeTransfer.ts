'use client'

/**
 * Phase 2 entry point — reserved for Skip-routed transfers. Currently not
 * wired into the bridge form, which runs in IBC-only mode. Kept here so the
 * Skip integration can be re-enabled without re-deriving the plumbing.
 */

import { useCallback, useState } from "react";
import { useSDKTx } from "./useTx";
import { useToast } from "./useToast";
import { skipGetMsgs } from "../query/skip";
import { convertSkipMsgToEncodeObject } from "../utils/cross_chain";
import { getChainName } from "../constants/chain";
import type { SkipRouteResponse } from "../types/cross_chain";

interface UseSkipBridgeTransferReturn {
  executeSkipTransfer: (
    route: SkipRouteResponse,
    getAddress: (chainId: string) => string | undefined | Promise<string | undefined>,
  ) => Promise<{ success: boolean; txHash?: string; chainId?: string; error?: string }>;
  isExecuting: boolean;
  progressMessage: string;
}

export function useSkipBridgeTransfer(signingChainName?: string): UseSkipBridgeTransferReturn {
  const { tx } = useSDKTx(signingChainName || getChainName());
  const { toast } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  const executeSkipTransfer = useCallback(async (
    route: SkipRouteResponse,
    getAddress: (chainId: string) => string | undefined | Promise<string | undefined>,
  ): Promise<{ success: boolean; txHash?: string; chainId?: string; error?: string }> => {
    // Reject multi-tx routes (EVM multi-step handled in Epic 5)
    if (route.txs_required > 1) {
      return { success: false, error: "This route requires multiple steps and is not yet supported." };
    }

    setIsExecuting(true);
    setProgressMessage('Collecting addresses...');

    try {
      // Build address list — getAddress can be async (for intermediate chains
      // that need a Keplr enable + getKey call to derive the address).
      const addressList: string[] = [];
      for (const chainId of route.required_chain_addresses) {
        const addr = await getAddress(chainId);
        if (!addr) {
          toast.error("Transfer failed", `Missing wallet address for chain ${chainId}`);
          return { success: false, error: `Missing address for chain ${chainId}` };
        }
        addressList.push(addr);
      }

      // Build messages request
      setProgressMessage('Building transfer...');
      const msgsResponse = await skipGetMsgs({
        source_asset_denom: route.source_asset_denom,
        source_asset_chain_id: route.source_asset_chain_id,
        dest_asset_denom: route.dest_asset_denom,
        dest_asset_chain_id: route.dest_asset_chain_id,
        amount_in: route.amount_in,
        amount_out: route.amount_out,
        address_list: addressList,
        operations: route.operations,
        slippage_tolerance_percent: "3",
        timeout_seconds: "600",
      });

      if (!msgsResponse?.txs?.length) {
        console.error('[useSkipBridgeTransfer] empty msgs response:', msgsResponse);
        toast.error("Transfer failed", "Could not build transfer messages.");
        return { success: false, error: "Failed to build transfer messages." };
      }

      // Extract first tx — Skip may return `msgs` or `cosmos_tx.msgs`
      const skipTx = msgsResponse.txs[0];
      const txMsgs = skipTx.msgs ?? (skipTx as any).cosmos_tx?.msgs;
      if (!txMsgs?.length) {
        console.error('[useSkipBridgeTransfer] no msgs on first tx:', JSON.stringify(skipTx).slice(0, 500));
        toast.error("Transfer failed", "No messages in transaction.");
        return { success: false, error: "No messages in transaction." };
      }

      // Convert messages to EncodeObjects
      const encodeObjects = txMsgs.map((msg: any) => convertSkipMsgToEncodeObject(msg));

      // Sign and broadcast. For foreign chains (not BZE), use direct sign
      // and let the wallet compute the fee — same pattern as IBC deposits.
      const isForeignChain = skipTx.chain_id !== 'beezee-1';
      setProgressMessage('Waiting for signature...');
      const success = await tx(encodeObjects, {
          useDirectSign: isForeignChain,
          letWalletSetFee: isForeignChain,
      });

      return {
        success,
        chainId: skipTx.chain_id,
      };
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Transfer failed';
      console.error('[useSkipBridgeTransfer] error:', e);
      return { success: false, error: errorMsg };
    } finally {
      setIsExecuting(false);
      setProgressMessage('');
    }
  }, [tx, toast]);

  return { executeSkipTransfer, isExecuting, progressMessage };
}
