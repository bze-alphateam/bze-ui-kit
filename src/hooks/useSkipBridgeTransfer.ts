'use client'

import { useCallback, useState } from "react";
import { useSDKTx } from "./useTx";
import { useToast } from "./useToast";
import { skipGetMsgs } from "../query/skip";
import { convertSkipMsgToEncodeObject, chainIdToChainName } from "../utils/cross_chain";
import { getChainName } from "../constants/chain";
import type { CrossChainTransferRequest, SkipRouteResponse } from "../types/cross_chain";

interface UseSkipBridgeTransferReturn {
  executeSkipTransfer: (
    request: CrossChainTransferRequest,
    route: SkipRouteResponse,
    getAddress: (chainId: string) => string | undefined,
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
    request: CrossChainTransferRequest,
    route: SkipRouteResponse,
    getAddress: (chainId: string) => string | undefined,
  ): Promise<{ success: boolean; txHash?: string; chainId?: string; error?: string }> => {
    // Reject multi-tx routes (EVM multi-step handled in Epic 5)
    if (route.txs_required > 1) {
      return { success: false, error: "This route requires multiple steps and is not yet supported." };
    }

    setIsExecuting(true);
    setProgressMessage('Collecting addresses...');

    try {
      // Build address list
      const addressList: string[] = [];
      for (const chainId of route.required_chain_addresses) {
        const addr = getAddress(chainId);
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
        timeout_seconds: 600,
      });

      if (!msgsResponse?.txs?.length) {
        toast.error("Transfer failed", "Could not build transfer messages.");
        return { success: false, error: "Failed to build transfer messages." };
      }

      // Extract first tx
      const skipTx = msgsResponse.txs[0];
      if (!skipTx.msgs.length) {
        toast.error("Transfer failed", "No messages in transaction.");
        return { success: false, error: "No messages in transaction." };
      }

      // Convert messages to EncodeObjects
      const encodeObjects = skipTx.msgs.map(msg => convertSkipMsgToEncodeObject(msg));

      // Sign and broadcast
      setProgressMessage('Waiting for signature...');
      const success = await tx(encodeObjects, { memo: "" });

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
