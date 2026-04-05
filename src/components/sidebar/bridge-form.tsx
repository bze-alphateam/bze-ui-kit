'use client'

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  createListCollection,
  Field,
  Group,
  HStack,
  Image,
  Input,
  Portal,
  Select,
  Text,
  VStack,
} from '@chakra-ui/react';
import { LuX } from 'react-icons/lu';
import { useChain } from '@interchain-kit/react';
import { WalletState } from '@interchain-kit/core';
import { getAllowedCosmosChains } from '../../constants/cross_chain';
import { getChainName } from '../../constants/chain';
import type { AllowedAsset, AllowedChain, TransferDirection } from '../../types/cross_chain';
import { useBridgeRoute } from '../../hooks/useBridgeRoute';
import { useBridgeTransfer } from '../../hooks/useBridgeTransfer';
import { sanitizeNumberInput } from '../../utils/number';
import { formatDuration } from '../../utils/cross_chain';
import { prettyAmount, uAmountToBigNumberAmount } from '../../utils/amount';
import { useBalances } from '../../hooks/useBalances';
import { useCounterpartyBalance } from '../../hooks/useCounterpartyBalance';
import BigNumber from 'bignumber.js';

interface BridgeFormProps {
  accentColor: string;
  onClose?: () => void;
}

export const BridgeForm = ({ accentColor, onClose }: BridgeFormProps) => {
  const [direction, setDirection] = useState<TransferDirection>('deposit');
  const [selectedChain, setSelectedChain] = useState<AllowedChain | undefined>();
  const [selectedAsset, setSelectedAsset] = useState<AllowedAsset | undefined>();
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');

  const { assetsBalances } = useBalances();
  const { routePreview, isLoading: isLoadingRoute, error: routeError } = useBridgeRoute(
    direction,
    selectedChain,
    selectedAsset,
    amount,
  );

  // Wallet connections
  const counterpartyChainName = selectedChain?.chainName ?? getChainName();
  const {
    status: counterpartyStatus,
    connect: openWalletPicker,
    wallet: counterpartyWallet,
    address: counterpartyAddress,
  } = useChain(counterpartyChainName);

  // ─── Source balance resolution ───────────────────────────────────────────
  // "Source balance" = what the user can actually spend in the current direction.
  //   • deposit → balance on the counterparty chain (e.g. ATONE on AtomOne)
  //   • withdraw → balance on BZE of the voucher denom. When bzeDenom isn't
  //     hardcoded in the allowlist, look it up via the live ibcChains mapping.

  // Resolve withdraw-side denom: prefer allowlist bzeDenom, fall back to a
  // matching IBC voucher already present in the user's BZE balances.
  const withdrawDenom = useMemo(() => {
    if (!selectedAsset) return undefined;
    if (selectedAsset.bzeDenom) return selectedAsset.bzeDenom;
    // Best-effort: find a balance on BZE whose IBC trace originates from the
    // selected counterparty chain and base denom.
    const match = assetsBalances.find((b) => {
      return b.IBCData?.counterparty.chainName === selectedChain?.chainName
        && b.IBCData?.counterparty.baseDenom === selectedAsset.sourceDenom;
    });
    return match?.denom;
  }, [selectedAsset, selectedChain, assetsBalances]);

  // Withdraw — lookup in BZE balances already loaded by the AssetsProvider.
  const withdrawBalance = useMemo(() => {
    if (!withdrawDenom) return undefined;
    return assetsBalances.find(b => b.denom === withdrawDenom);
  }, [assetsBalances, withdrawDenom]);

  // Deposit — fetch live from the counterparty chain REST endpoint.
  const {
    amount: depositRawBalance,
    status: depositBalanceStatus,
    refetch: refetchDepositBalance,
  } = useCounterpartyBalance(
    direction === 'deposit' ? selectedChain?.chainName : undefined,
    direction === 'deposit' ? counterpartyAddress : undefined,
    direction === 'deposit' ? selectedAsset?.sourceDenom : undefined,
  );

  // Unified "source balance" used by display, validation, and Max button.
  const sourceBalance = useMemo(() => {
    if (!selectedAsset) return undefined;
    if (direction === 'withdraw') {
      if (!withdrawBalance) return undefined;
      return {
        raw: withdrawBalance.amount as unknown as BigNumber,
        display: uAmountToBigNumberAmount(withdrawBalance.amount, withdrawBalance.decimals),
        decimals: withdrawBalance.decimals,
        status: 'ready' as const,
      };
    }
    // deposit
    return {
      raw: depositRawBalance,
      display: uAmountToBigNumberAmount(depositRawBalance, selectedAsset.decimals),
      decimals: selectedAsset.decimals,
      status: depositBalanceStatus,
    };
  }, [direction, selectedAsset, withdrawBalance, depositRawBalance, depositBalanceStatus]);

  // Prefer calling the already-connected wallet's chain-level connect directly
  // (which triggers Keplr/Leap's "enable chain X" prompt). Fall back to opening
  // the wallet picker modal when no wallet is connected yet.
  const handleConnectCounterparty = useCallback(async () => {
    const ws: any = counterpartyWallet;
    if (ws && typeof ws.connect === 'function') {
      try {
        await ws.connect();
        return;
      } catch (e) {
        console.error('[bridge] counterparty connect failed:', e);
      }
    }
    openWalletPicker();
  }, [counterpartyWallet, openWalletPicker]);

  // Transfer execution
  const { executeTransfer, isExecuting, progressMessage } = useBridgeTransfer(
    direction, selectedChain, selectedAsset, amount, routePreview,
  );

  // Whether the balance gate lets the transfer proceed.
  //   ready + >0   → allow
  //   ready + 0    → block (explicit zero)
  //   loading      → block transiently
  //   error        → block (we couldn't verify)
  //   unsupported  → allow — we informed the user we can't see their balance
  const balanceAllowsTransfer = useMemo(() => {
    if (!sourceBalance) return false;
    if (sourceBalance.status === 'unsupported') return true;
    if (sourceBalance.status !== 'ready') return false;
    return sourceBalance.display.isGreaterThan(0);
  }, [sourceBalance]);

  const canExecute = useMemo(() => {
    return selectedChain
      && selectedAsset
      && amount !== ''
      && amountError === ''
      && routePreview !== undefined
      && (!routePreview.rawRoute || routePreview.txsRequired <= 1)
      && !isExecuting
      && !isLoadingRoute
      && counterpartyStatus === WalletState.Connected
      && balanceAllowsTransfer;
  }, [selectedChain, selectedAsset, amount, amountError, routePreview, isExecuting, isLoadingRoute, counterpartyStatus, balanceAllowsTransfer]);

  const handleExecute = useCallback(async () => {
    const success = await executeTransfer();
    if (success) {
      setAmount('');
      setSelectedAsset(undefined);
      setSelectedChain(undefined);
      // Kick the counterparty balance query so a follow-up transfer picks up
      // the new state on the foreign chain once the relayer delivers.
      setTimeout(() => refetchDepositBalance(), 4000);
      setTimeout(() => refetchDepositBalance(), 10000);
    }
  }, [executeTransfer, refetchDepositBalance]);

  // Available chains (EVM chains will be added in Epic 5)
  const availableChains = useMemo(() => getAllowedCosmosChains(), []);

  const chainsCollection = useMemo(() => {
    return createListCollection({
      items: availableChains.map(c => ({
        label: c.displayName,
        value: c.chainName,
        logo: c.logo,
      })),
    });
  }, [availableChains]);

  const assetsCollection = useMemo(() => {
    const items = (selectedChain?.assets ?? []).map(a => ({
      label: a.ticker,
      value: a.sourceDenom,
      logo: a.logo,
      displayName: a.displayName,
    }));
    return createListCollection({ items });
  }, [selectedChain]);

  // Auto-select first asset when chain has only one asset
  useEffect(() => {
    if (selectedChain && selectedChain.assets.length === 1) {
      setSelectedAsset(selectedChain.assets[0]);
    }
  }, [selectedChain]);

  const onChainChange = useCallback((chainName: string) => {
    if (!chainName) return;
    const chain = availableChains.find(c => c.chainName === chainName);
    setSelectedChain(chain);
    setSelectedAsset(undefined);
    setAmount('');
    setAmountError('');
  }, [availableChains]);

  const onAssetChange = useCallback((sourceDenom: string) => {
    if (!sourceDenom || !selectedChain) return;
    const asset = selectedChain.assets.find(a => a.sourceDenom === sourceDenom);
    setSelectedAsset(asset);
    setAmount('');
    setAmountError('');
  }, [selectedChain]);

  const onAmountChange = useCallback((value: string) => {
    setAmount(sanitizeNumberInput(value));
    setAmountError('');
  }, []);

  const setMaxAmount = useCallback(() => {
    if (!sourceBalance || sourceBalance.status !== 'ready') return;
    setAmount(sourceBalance.display.toString());
    setAmountError('');
  }, [sourceBalance]);

  const validateAmount = useCallback(() => {
    if (!amount || !sourceBalance || sourceBalance.status !== 'ready') return;
    if (sourceBalance.display.isLessThan(amount)) {
      setAmountError('Insufficient balance');
    }
  }, [amount, sourceBalance]);

  // Fee display
  const feeDisplay = useMemo(() => {
    if (!routePreview || routePreview.fees.length === 0) return undefined;
    return routePreview.fees
      .map(f => {
        if (f.usdValue) return `$${prettyAmount(f.usdValue)}`;
        return `${f.amount} ${f.ticker}`;
      })
      .join(' + ');
  }, [routePreview]);

  return (
    <VStack gap="4" align="stretch">
      {/* Header */}
      <HStack justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="medium">
          Deposit / Withdraw
        </Text>
        {onClose && (
          <Button size="xs" variant="ghost" onClick={onClose}>
            <LuX size="14" />
          </Button>
        )}
      </HStack>

      {/* Direction Toggle */}
      <HStack gap="1" w="full">
        <Button
          flex="1"
          size="sm"
          variant={direction === 'deposit' ? 'solid' : 'ghost'}
          colorPalette={accentColor}
          onClick={() => setDirection('deposit')}
        >
          Deposit
        </Button>
        <Button
          flex="1"
          size="sm"
          variant={direction === 'withdraw' ? 'solid' : 'ghost'}
          colorPalette={accentColor}
          onClick={() => setDirection('withdraw')}
        >
          Withdraw
        </Button>
      </HStack>

      {/* Direction Description */}
      <Text fontSize="sm" color="fg.muted">
        {direction === 'deposit'
          ? 'Deposit assets from other networks to BeeZee'
          : 'Send assets from BeeZee to other networks'}
      </Text>

      {/* Network Selector */}
      <Box>
        <Select.Root
          collection={chainsCollection}
          size="sm"
          value={selectedChain ? [selectedChain.chainName] : []}
          onValueChange={(details) => onChainChange(details.value[0] || '')}
        >
          <Select.Label>Network</Select.Label>
          <Select.HiddenSelect />
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder="Select network" />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {chainsCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    <HStack gap="2">
                      <Image
                        src={item.logo}
                        alt={item.value}
                        width="16px"
                        height="16px"
                        borderRadius="full"
                      />
                      <Text>{item.label}</Text>
                    </HStack>
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>
      </Box>

      {/* Asset Selector — shown when chain is selected and has multiple assets */}
      {selectedChain && selectedChain.assets.length > 1 && (
        <Box>
          <Select.Root
            collection={assetsCollection}
            size="sm"
            value={selectedAsset ? [selectedAsset.sourceDenom] : []}
            onValueChange={(details) => onAssetChange(details.value[0] || '')}
          >
            <Select.Label>Asset</Select.Label>
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger>
                <Select.ValueText placeholder="Select asset" />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content>
                  {assetsCollection.items.map((item) => (
                    <Select.Item key={item.value} item={item}>
                      <HStack gap="2">
                        <Image
                          src={item.logo}
                          alt={item.value}
                          width="16px"
                          height="16px"
                          borderRadius="full"
                        />
                        <Text>{item.label}</Text>
                      </HStack>
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>
        </Box>
      )}

      {/* Single asset display — when chain has exactly one asset */}
      {selectedChain && selectedChain.assets.length === 1 && selectedAsset && (
        <Box>
          <Text fontSize="xs" fontWeight="medium" mb="1">Asset</Text>
          <HStack
            gap="2"
            p="2"
            borderWidth="1px"
            borderColor={`${accentColor}.500/20`}
            borderRadius="md"
          >
            <Image
              src={selectedAsset.logo}
              alt={selectedAsset.ticker}
              width="16px"
              height="16px"
              borderRadius="full"
            />
            <Text fontSize="sm">{selectedAsset.ticker}</Text>
            <Text fontSize="xs" color="fg.muted">{selectedAsset.displayName}</Text>
          </HStack>
        </Box>
      )}

      {/* Amount Input */}
      {selectedChain && selectedAsset && (
        <Box>
          <Field.Root invalid={amountError !== ''}>
            <Field.Label>
              {direction === 'deposit' ? 'Amount to receive' : 'Amount to send'}
            </Field.Label>
            <Group attached w="full">
              <Input
                size="sm"
                placeholder="0.00"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                onBlur={validateAmount}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={setMaxAmount}
                disabled={!sourceBalance || sourceBalance.status !== 'ready'}
              >
                Max
              </Button>
            </Group>
            <Field.ErrorText>{amountError}</Field.ErrorText>
          </Field.Root>

          {/* Available-balance hint */}
          {sourceBalance && (
            <HStack justify="space-between" mt="1.5">
              <Text fontSize="xs" color="fg.muted">
                {direction === 'deposit'
                  ? `Available on ${selectedChain.displayName}`
                  : 'Available on BeeZee'}
              </Text>
              {sourceBalance.status === 'loading' && (
                <Text fontSize="xs" color="fg.muted">Loading…</Text>
              )}
              {sourceBalance.status === 'ready' && (
                <Text fontSize="xs" fontFamily="mono">
                  {prettyAmount(sourceBalance.display)} {selectedAsset.ticker}
                </Text>
              )}
              {sourceBalance.status === 'error' && (
                <Text fontSize="xs" color="orange.500">Couldn&apos;t fetch</Text>
              )}
              {sourceBalance.status === 'unsupported' && (
                <Text fontSize="xs" color="fg.muted">Unavailable</Text>
              )}
            </HStack>
          )}

          {/* Zero-balance notice (only when we actually know it's zero) */}
          {sourceBalance?.status === 'ready' && sourceBalance.display.isZero() && (
            <Text fontSize="xs" color="orange.500" mt="1">
              {direction === 'deposit'
                ? `You have no ${selectedAsset.ticker} on ${selectedChain.displayName}.`
                : `You have no ${selectedAsset.ticker} on BeeZee.`}
            </Text>
          )}

          {/* REST endpoint missing — we can't show the balance */}
          {sourceBalance?.status === 'unsupported' && direction === 'deposit' && (
            <Text fontSize="xs" color="fg.muted" mt="1">
              We can&apos;t see your balance on {selectedChain.displayName} right now.
              Please double-check it in your wallet before transferring.
            </Text>
          )}
        </Box>
      )}

      {/* Route Preview */}
      {routePreview && amount && !isLoadingRoute && (
        <Box
          p="3"
          bgGradient="to-br"
          gradientFrom={`${accentColor}.500/8`}
          gradientTo={`${accentColor}.600/8`}
          borderRadius="md"
          borderWidth="1px"
          borderColor={`${accentColor}.500/20`}
        >
          <VStack gap="2" align="stretch">
            <HStack justify="space-between">
              <Text fontSize="sm" color="fg.muted">You receive</Text>
              <Text fontSize="sm" fontWeight="medium" fontFamily="mono">
                {routePreview.estimatedOutput} {routePreview.estimatedOutputTicker}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="xs" color="fg.muted">Estimated time</Text>
              <Text fontSize="xs">{formatDuration(routePreview.estimatedDurationSeconds)}</Text>
            </HStack>
            {feeDisplay && (
              <HStack justify="space-between">
                <Text fontSize="xs" color="fg.muted">Fee</Text>
                <Text fontSize="xs">{feeDisplay}</Text>
              </HStack>
            )}
            {routePreview.warning && (
              <Text fontSize="xs" color="orange.500">{routePreview.warning}</Text>
            )}
          </VStack>
        </Box>
      )}

      {/* Loading State */}
      {isLoadingRoute && amount && (
        <Box p="3" bg={`${accentColor}.500/5`} borderRadius="md">
          <VStack gap="2">
            <Box h="4" w="60%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse" />
            <Box h="4" w="40%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse" />
          </VStack>
        </Box>
      )}

      {/* Route Error */}
      {routeError && amount && !isLoadingRoute && (
        <Text fontSize="sm" color="red.500">{routeError}</Text>
      )}

      {/* Multi-tx warning */}
      {routePreview && routePreview.txsRequired > 1 && (
        <Box p="3" bg="orange.500/10" borderRadius="md" borderWidth="1px" borderColor="orange.500/30">
          <Text fontSize="sm" color="orange.600">
            This route requires multiple steps and is not supported yet. Try a different asset or amount.
          </Text>
        </Box>
      )}

      {/* Wallet connection prompt — needed in both directions so we have a receiver/sender address */}
      {selectedChain && counterpartyStatus !== WalletState.Connected && (
        <VStack gap="3">
          <Text fontSize="sm" color="fg.muted">
            {direction === 'deposit'
              ? `Connect your wallet on ${selectedChain.displayName} to continue`
              : `Connect your wallet on ${selectedChain.displayName} to receive funds`}
          </Text>
          <Button size="sm" w="full" colorPalette={accentColor} onClick={handleConnectCounterparty}>
            Connect to {selectedChain.displayName}
          </Button>
        </VStack>
      )}

      {/* Execute Button */}
      <Button
        size="sm"
        w="full"
        colorPalette={accentColor}
        disabled={!canExecute}
        loading={isExecuting}
        loadingText={progressMessage || "Transferring..."}
        onClick={handleExecute}
      >
        Transfer
      </Button>
    </VStack>
  );
};
