'use client'

import {useCallback, useEffect, useMemo, useState} from 'react';
import {
    Box,
    Button,
    createListCollection,
    Field,
    Group,
    HStack,
    Input,
    Portal,
    Select,
    Text,
    VStack,
} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import {TokenLogo} from '../token-logo';
import {useBridgeableAssets, type BridgeableAsset, type BridgeableChain} from '../../hooks/useBridgeableAssets';
import {useBridgeRoute} from '../../hooks/useBridgeRoute';
import {useBridgeTransfer} from '../../hooks/useBridgeTransfer';
import {useCounterpartyBalance} from '../../hooks/useCounterpartyBalance';
import {sanitizeNumberInput} from '../../utils/number';
import {formatDuration} from '../../utils/cross_chain';
import {prettyAmount, uAmountToBigNumberAmount} from '../../utils/amount';

interface DepositFormProps {
    accentColor: string;
}

/**
 * Deposit flow: move an asset from a foreign chain onto BeeZee.
 *
 * The picker is driven by `useBridgeableAssets`, which derives the set of
 * depositable assets from chain-registry + BZE's existing IBC traces — no
 * hardcoded allowlist. Each counterparty chain the user selects exposes the
 * assets that can arrive on BZE from that chain.
 */
export const DepositForm = ({accentColor}: DepositFormProps) => {
    const [selectedChain, setSelectedChain] = useState<BridgeableChain | undefined>();
    const [selectedAsset, setSelectedAsset] = useState<BridgeableAsset | undefined>();
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');

    const {chains: bridgeableChains, isLoading: isLoadingAssets} = useBridgeableAssets();

    const {routePreview, isLoading: isLoadingRoute, error: routeError} = useBridgeRoute(
        'deposit',
        selectedAsset,
        amount,
    );

    // ─── Counterparty wallet ───────────────────────────────────────────────
    const counterpartyChainName = selectedChain?.chainName;
    const {
        status: counterpartyStatus,
        connect: openWalletPicker,
        wallet: counterpartyWallet,
        address: counterpartyAddress,
    } = useChain(counterpartyChainName ?? 'beezee');

    // ─── Live balance on counterparty chain (via REST) ─────────────────────
    const {
        amount: depositRawBalance,
        status: depositBalanceStatus,
        refetch: refetchDepositBalance,
    } = useCounterpartyBalance(
        selectedChain?.chainName,
        counterpartyAddress,
        selectedAsset?.ibcData.counterparty.baseDenom,
    );

    const sourceBalance = useMemo(() => {
        if (!selectedAsset) return undefined;
        return {
            display: uAmountToBigNumberAmount(depositRawBalance, selectedAsset.bzeAsset.decimals),
            decimals: selectedAsset.bzeAsset.decimals,
            status: depositBalanceStatus,
        };
    }, [selectedAsset, depositRawBalance, depositBalanceStatus]);

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

    const {executeTransfer, isExecuting, progressMessage} = useBridgeTransfer({
        direction: 'deposit',
        asset: selectedAsset,
        amount,
        routePreview,
    });

    // Balance gate — see `useCounterpartyBalance` for the status values.
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
            // IBC relaying is async — re-check the counterparty balance in a
            // little while so a follow-up deposit sees the new state.
            setTimeout(() => refetchDepositBalance(), 4000);
            setTimeout(() => refetchDepositBalance(), 10000);
        }
    }, [executeTransfer, refetchDepositBalance]);

    // ─── Chakra Select collections ─────────────────────────────────────────
    const chainsCollection = useMemo(() => {
        return createListCollection({
            items: bridgeableChains.map(c => ({
                label: c.displayName,
                value: c.chainName,
                logo: c.logo,
            })),
        });
    }, [bridgeableChains]);

    const assetsCollection = useMemo(() => {
        const items = (selectedChain?.assets ?? []).map(a => ({
            label: a.bzeAsset.ticker,
            value: a.bzeAsset.denom,
            logo: a.bzeAsset.logo,
            displayName: a.bzeAsset.name,
        }));
        return createListCollection({items});
    }, [selectedChain]);

    // Auto-select first asset when a chain has only one bridgeable asset
    useEffect(() => {
        if (selectedChain && selectedChain.assets.length === 1) {
            setSelectedAsset(selectedChain.assets[0]);
        }
    }, [selectedChain]);

    const onChainChange = useCallback((chainName: string) => {
        if (!chainName) return;
        const chain = bridgeableChains.find(c => c.chainName === chainName);
        setSelectedChain(chain);
        setSelectedAsset(undefined);
        setAmount('');
        setAmountError('');
    }, [bridgeableChains]);

    const onAssetChange = useCallback((denom: string) => {
        if (!denom || !selectedChain) return;
        const asset = selectedChain.assets.find(a => a.bzeAsset.denom === denom);
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

    const counterpartyDisplayName = selectedAsset?.counterparty.displayName ?? selectedChain?.displayName ?? '';

    const feeDisplay = useMemo(() => {
        if (!routePreview || routePreview.fees.length === 0) return undefined;
        return routePreview.fees
            .map(f => (f.usdValue ? `$${prettyAmount(f.usdValue)}` : `${f.amount} ${f.ticker}`))
            .join(' + ');
    }, [routePreview]);

    return (
        <VStack gap="4" align="stretch">
            <Text fontSize="sm" color="fg.muted">
                Deposit assets from other networks to BeeZee
            </Text>

            {!isLoadingAssets && bridgeableChains.length === 0 && (
                <Box p="3" bg="fg.muted/5" borderRadius="md">
                    <Text fontSize="sm" color="fg.muted">
                        No bridgeable assets found yet. Receive an IBC asset on BeeZee first,
                        then come back here to transfer it across chains.
                    </Text>
                </Box>
            )}

            {bridgeableChains.length > 0 && (
                <Box>
                    <Select.Root
                        collection={chainsCollection}
                        size="sm"
                        value={selectedChain ? [selectedChain.chainName] : []}
                        onValueChange={(details) => onChainChange(details.value[0] || '')}
                    >
                        <Select.Label>Network</Select.Label>
                        <Select.HiddenSelect/>
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder="Select network"/>
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator/>
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {chainsCollection.items.map((item) => (
                                        <Select.Item key={item.value} item={item}>
                                            <HStack gap="2">
                                                <TokenLogo src={item.logo} symbol={item.label} size="16px"/>
                                                <Text>{item.label}</Text>
                                            </HStack>
                                            <Select.ItemIndicator/>
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                </Box>
            )}

            {selectedChain && selectedChain.assets.length > 1 && (
                <Box>
                    <Select.Root
                        collection={assetsCollection}
                        size="sm"
                        value={selectedAsset ? [selectedAsset.bzeAsset.denom] : []}
                        onValueChange={(details) => onAssetChange(details.value[0] || '')}
                    >
                        <Select.Label>Asset</Select.Label>
                        <Select.HiddenSelect/>
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder="Select asset"/>
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator/>
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {assetsCollection.items.map((item) => (
                                        <Select.Item key={item.value} item={item}>
                                            <HStack gap="2">
                                                <TokenLogo src={item.logo} symbol={item.label} size="16px"/>
                                                <Text>{item.label}</Text>
                                            </HStack>
                                            <Select.ItemIndicator/>
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                </Box>
            )}

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
                        <TokenLogo
                            src={selectedAsset.bzeAsset.logo}
                            symbol={selectedAsset.bzeAsset.ticker}
                            size="16px"
                        />
                        <Text fontSize="sm">{selectedAsset.bzeAsset.ticker}</Text>
                        <Text fontSize="xs" color="fg.muted">{selectedAsset.bzeAsset.name}</Text>
                    </HStack>
                </Box>
            )}

            {selectedAsset && (
                <Text fontSize="xs" color="fg.muted">
                    From {counterpartyDisplayName} → BeeZee
                </Text>
            )}

            {selectedChain && selectedAsset && (
                <Box>
                    <Field.Root invalid={amountError !== ''}>
                        <Field.Label>Amount to receive</Field.Label>
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

                    {sourceBalance && (
                        <HStack justify="space-between" mt="1.5">
                            <Text fontSize="xs" color="fg.muted">
                                Available on {counterpartyDisplayName}
                            </Text>
                            {sourceBalance.status === 'loading' && (
                                <Text fontSize="xs" color="fg.muted">Loading…</Text>
                            )}
                            {sourceBalance.status === 'ready' && (
                                <Text fontSize="xs" fontFamily="mono">
                                    {prettyAmount(sourceBalance.display)} {selectedAsset.bzeAsset.ticker}
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

                    {sourceBalance?.status === 'ready' && sourceBalance.display.isZero() && (
                        <Text fontSize="xs" color="orange.500" mt="1">
                            You have no {selectedAsset.bzeAsset.ticker} on {counterpartyDisplayName}.
                        </Text>
                    )}

                    {sourceBalance?.status === 'unsupported' && (
                        <Text fontSize="xs" color="fg.muted" mt="1">
                            We couldn&apos;t connect to {counterpartyDisplayName} to check your balance.
                            The transfer might still work — double-check the amount in your wallet before signing.
                        </Text>
                    )}
                </Box>
            )}

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

            {routeError && amount && !isLoadingRoute && (
                <Text fontSize="sm" color="red.500">{routeError}</Text>
            )}

            {selectedChain && counterpartyStatus !== WalletState.Connected && (
                <VStack gap="3">
                    <Text fontSize="sm" color="fg.muted">
                        Connect your wallet on {counterpartyDisplayName} to continue
                    </Text>
                    <Button size="sm" w="full" colorPalette={accentColor} onClick={handleConnectCounterparty}>
                        Connect to {counterpartyDisplayName}
                    </Button>
                </VStack>
            )}

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
