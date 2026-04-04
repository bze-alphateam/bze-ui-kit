'use client'

import { useCallback, useMemo } from "react";
import { useChain } from "@interchain-kit/react";
import type {
  AllowedAsset, AllowedChain, CrossChainTransferRequest,
  RoutePreview, TransferDirection,
} from "../types/cross_chain";
import { getTransferMechanism, BZE_SKIP_CHAIN_ID } from "../constants/cross_chain";
import { getChainName, getChainByChainId } from "../constants/chain";
import { useIbcBridgeTransfer } from "./useIbcBridgeTransfer";
import { useSkipBridgeTransfer } from "./useSkipBridgeTransfer";
import { useIBCChains } from "./useAssets";
import { findIbcDataForChain } from "../utils/cross_chain";
import { useToast } from "./useToast";

interface UseBridgeTransferReturn {
  executeTransfer: () => Promise<boolean>;
  isExecuting: boolean;
  progressMessage: string;
}

export function useBridgeTransfer(
  direction: TransferDirection,
  chain: AllowedChain | undefined,
  asset: AllowedAsset | undefined,
  amount: string,
  routePreview: RoutePreview | undefined,
): UseBridgeTransferReturn {
  const { toast } = useToast();

  // Determine source chain for signing
  const sourceChainName = useMemo(() => {
    if (!chain) return getChainName();
    return direction === 'deposit' ? chain.chainName : getChainName();
  }, [direction, chain]);

  // Wallet addresses
  const bzeChain = useChain(getChainName());
  const counterpartyChain = useChain(chain?.chainName ?? getChainName());

  // IBC data
  const { ibcChains } = useIBCChains();
  const ibcData = useMemo(() => {
    if (!chain) return undefined;
    return findIbcDataForChain(ibcChains, chain.chainName);
  }, [ibcChains, chain]);

  // Transfer hooks
  const ibcTransfer = useIbcBridgeTransfer(sourceChainName);

  // For Skip, the signing chain comes from the route's first tx.
  // For deposits, it's the counterparty chain. For withdrawals, it's BZE.
  const skipSigningChainName = useMemo(() => {
    if (!routePreview?.rawRoute) return sourceChainName;
    // The first tx's chain_id tells us where to sign
    // We don't have the msgs yet, so use the source chain from the route
    const sourceChainId = routePreview.rawRoute.source_asset_chain_id;
    const resolved = getChainByChainId(sourceChainId);
    return resolved?.chainName ?? sourceChainName;
  }, [routePreview, sourceChainName]);

  const skipTransfer = useSkipBridgeTransfer(skipSigningChainName);

  // Address resolver for Skip routes
  const getAddressForChainId = useCallback((chainId: string): string | undefined => {
    if (chainId === BZE_SKIP_CHAIN_ID || chainId === 'beezee-1') {
      return bzeChain.address;
    }
    if (chain && chainId === chain.skipChainId) {
      return counterpartyChain.address;
    }
    // For intermediate chains, try resolving via chain registry
    const resolved = getChainByChainId(chainId);
    if (resolved?.chainName === getChainName()) {
      return bzeChain.address;
    }
    if (resolved?.chainName === chain?.chainName) {
      return counterpartyChain.address;
    }
    return undefined;
  }, [bzeChain.address, counterpartyChain.address, chain]);

  const executeTransfer = useCallback(async (): Promise<boolean> => {
    if (!chain || !asset || !amount) {
      toast.error("Transfer failed", "Missing transfer parameters.");
      return false;
    }

    if (!bzeChain.address || !counterpartyChain.address) {
      toast.error(
        "Transfer failed",
        `Please connect your wallet on ${chain.displayName} first.`,
      );
      return false;
    }

    const mechanism = getTransferMechanism(chain.chainName);

    const request: CrossChainTransferRequest = {
      direction,
      sourceChain: direction === 'deposit' ? chain : { chainName: getChainName(), displayName: 'BeeZee', logo: '', addressPrefix: 'bze', skipChainId: BZE_SKIP_CHAIN_ID, isEvm: false, hasDirectIbc: true, assets: [] },
      destChain: direction === 'deposit' ? { chainName: getChainName(), displayName: 'BeeZee', logo: '', addressPrefix: 'bze', skipChainId: BZE_SKIP_CHAIN_ID, isEvm: false, hasDirectIbc: true, assets: [] } : chain,
      asset,
      amount,
      sourceAddress: direction === 'deposit' ? (counterpartyChain.address ?? '') : (bzeChain.address ?? ''),
      destAddress: direction === 'deposit' ? (bzeChain.address ?? '') : (counterpartyChain.address ?? ''),
      mechanism,
    };

    if (mechanism === 'ibc' && ibcData) {
      return ibcTransfer.executeIbcTransfer(request, ibcData);
    }

    if (mechanism === 'skip' && routePreview?.rawRoute) {
      const result = await skipTransfer.executeSkipTransfer(request, routePreview.rawRoute, getAddressForChainId);
      if (!result.success && result.error) {
        toast.error("Transfer failed", result.error);
      }
      return result.success;
    }

    toast.error("Transfer failed", "Could not determine transfer method.");
    return false;
  }, [chain, asset, amount, direction, bzeChain.address, counterpartyChain.address, ibcData, ibcTransfer, skipTransfer, routePreview, getAddressForChainId, toast]);

  const isExecuting = ibcTransfer.isExecuting || skipTransfer.isExecuting;
  const progressMessage = ibcTransfer.progressMessage || skipTransfer.progressMessage;

  return { executeTransfer, isExecuting, progressMessage };
}
