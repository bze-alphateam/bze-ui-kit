'use client'

import { useCallback, useState } from "react";
import { ibc } from "@bze/bzejs";
import { useIBCTx } from "./useTx";
import { amountToUAmount } from "../utils/amount";
import { getIbcTransferTimeout } from "../utils/ibc";
import type { CrossChainTransferRequest } from "../types/cross_chain";
import type { IBCData } from "../types/asset";
import { useAssetsContext } from "./useAssets";
import { sleep } from "../utils/functions";

/**
 * Compute an IBC voucher denom on the destination chain from the transfer path.
 * denom = ibc/SHA256("transfer/{channelId}/{baseDenom}") hex uppercase.
 */
const computeIbcDenom = async (channelId: string, baseDenom: string): Promise<string> => {
  const path = `transfer/${channelId}/${baseDenom}`;
  const data = new TextEncoder().encode(path);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `ibc/${hashHex}`;
};

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
  const { updateBalances } = useAssetsContext();
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  const executeIbcTransfer = useCallback(async (
    request: CrossChainTransferRequest,
    ibcData: IBCData,
  ): Promise<boolean> => {
    if (!request.amount || !request.sourceAddress || !request.destAddress) {
      console.error('[useIbcBridgeTransfer] missing address', {
        source: request.sourceAddress, dest: request.destAddress,
      });
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
      let tokenDenom = isDeposit
        ? request.asset.sourceDenom
        : request.asset.bzeDenom;

      // When withdrawing an asset whose voucher denom on BZE was not hardcoded
      // in the allowlist, compute it dynamically from the transfer path.
      if (!isDeposit && !tokenDenom) {
        tokenDenom = await computeIbcDenom(ibcData.chain.channelId, request.asset.sourceDenom);
      }

      if (!tokenDenom) {
        console.error('[useIbcBridgeTransfer] unable to resolve token denom');
        return false;
      }

      const tokenAmount = amountToUAmount(request.amount, request.asset.decimals);

      const msg = transfer({
        sourcePort: "transfer",
        sourceChannel,
        token: { denom: tokenDenom, amount: tokenAmount },
        sender: request.sourceAddress,
        receiver: request.destAddress,
        // Must be undefined (not { 0n, 0n }) — an all-zero Height serializes into
        // the amino sign doc as an empty object and produces a signature mismatch
        // against the chain's verification bytes. app.getbze.com does the same.
        timeoutHeight: undefined as any,
        timeoutTimestamp: BigInt(getIbcTransferTimeout().toFixed(0)),
        memo: "",
        encoding: "",
        useAliasing: false,
      });

      setProgressMessage('Waiting for signature...');
      // Force direct sign — bzejs v3 MsgTransfer amino converter is not compatible
      // with BZE chain's running proto version and fails verification with code 4.
      // For deposits (signing on a foreign chain), we don't know the correct gas
      // price, so we ask Keplr/Leap to compute and fill the fee itself.
      const success = await tx([msg], {
        memo: "",
        useDirectSign: true,
        letWalletSetFee: isDeposit,
      });

      // IBC relaying is asynchronous — the source-chain tx being confirmed only
      // means the funds were escrowed (withdraw) or the packet was initiated. The
      // user's visible BZE balance updates once the relayer delivers the packet.
      // Trigger a few delayed refreshes so the sidebar picks it up without a reload.
      if (success) {
        setProgressMessage('Waiting for relayer...');
        updateBalances();
        sleep(4000).then(() => updateBalances());
        sleep(10000).then(() => updateBalances());
      }

      return success;
    } catch (e) {
      console.error('[useIbcBridgeTransfer] error:', e);
      return false;
    } finally {
      setIsExecuting(false);
      setProgressMessage('');
    }
  }, [tx, updateBalances]);

  return { executeIbcTransfer, isExecuting, progressMessage };
}
