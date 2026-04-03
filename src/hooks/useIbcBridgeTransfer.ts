'use client'

import { useCallback, useState } from "react";
import { ibc } from "@bze/bzejs";
import { useIBCTx } from "./useTx";
import { amountToUAmount } from "../utils/amount";
import { getIbcTransferTimeout } from "../utils/ibc";
import type { CrossChainTransferRequest } from "../types/cross_chain";
import type { IBCData } from "../types/asset";

interface UseIbcBridgeTransferReturn {
  executeIbcTransfer: (
    request: CrossChainTransferRequest,
    ibcData: IBCData,
  ) => Promise<boolean>;
  isExecuting: boolean;
  progressMessage: string;
}

export function useIbcBridgeTransfer(chainName: string): UseIbcBridgeTransferReturn {
  const { tx } = useIBCTx(chainName);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  const executeIbcTransfer = useCallback(async (
    request: CrossChainTransferRequest,
    ibcData: IBCData,
  ): Promise<boolean> => {
    if (!request.amount || !request.sourceAddress || !request.destAddress) {
      return false;
    }

    setIsExecuting(true);
    setProgressMessage('Preparing transfer...');

    try {
      const { transfer } = ibc.applications.transfer.v1.MessageComposer.withTypeUrl;

      const isDeposit = request.direction === 'deposit';
      const sourceChannel = isDeposit
        ? ibcData.counterparty.channelId
        : ibcData.chain.channelId;
      const tokenDenom = isDeposit
        ? request.asset.sourceDenom
        : request.asset.bzeDenom;
      const tokenAmount = amountToUAmount(request.amount, request.asset.decimals);

      const msg = transfer({
        sourcePort: "transfer",
        sourceChannel,
        token: { denom: tokenDenom, amount: tokenAmount },
        sender: request.sourceAddress,
        receiver: request.destAddress,
        timeoutHeight: { revisionNumber: BigInt(0), revisionHeight: BigInt(0) },
        timeoutTimestamp: BigInt(getIbcTransferTimeout().toFixed(0)),
        memo: "",
        encoding: "",
        useAliasing: false,
      });

      setProgressMessage('Waiting for signature...');
      const success = await tx([msg], { memo: "" });

      return success;
    } catch (e) {
      console.error('[useIbcBridgeTransfer] error:', e);
      return false;
    } finally {
      setIsExecuting(false);
      setProgressMessage('');
    }
  }, [tx]);

  return { executeIbcTransfer, isExecuting, progressMessage };
}
