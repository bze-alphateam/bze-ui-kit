'use client'

import {useCallback, useMemo, useState} from 'react';
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
import {useBridgeableAssets, type BridgeableAsset} from '../../hooks/useBridgeableAssets';
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
 * Asset-first picker mirroring the withdraw form. The flat list contains every
 * BZE IBC voucher with a complete trace (1-hop native assets from direct
 * counterparties). Each asset has exactly one source chain, so no network
 * picker is needed — the source is shown as a read-only label after selection.
 */
export const DepositForm = ({accentColor}: DepositFormProps) => {
    const [selectedAsset, setSelectedAsset] = useState<BridgeableAsset | undefined>();
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');

    const {assets: bridgeableAssets, isLoading: isLoadingAssets} = useBridgeableAssets();

    // ─── Asset picker collection (flat list, sorted by ticker) ─────────────
    const assetsCollection = useMemo(() => {
        return createListCollection({
            items: bridgeableAssets.map(a => ({
                label: a.bzeAsset.ticker,
                value: a.bzeAsset.denom,
                logo: a.bzeAsset.logo,
                displayName: a.bzeAsset.name,
                chainDisplayName: a.counterparty.displayName,
            })),
        });
    }, [bridgeableAssets]);

    // ─── Counterparty wallet ───────────────────────────────────────────────
    const sourceChainName = selectedAsset?.counterparty.chainName ?? 'beezee';
    const {
        status: sourceWalletStatus,
        connect: openWalletPicker,
        wallet: sourceWallet,
        address: sourceAddress,
    } = useChain(sourceChainName);

    // ─── Live balance on source chain (via REST) ───────────────────────────
    const {
        amount: depositRawBalance,
        status: depositBalanceStatus,
        refetch: refetchDepositBalance,
    } = useCounterpartyBalance(
        selectedAsset?.counterparty.chainName,
        sourceAddress,
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

    const handleConnectSource = useCallback(async () => {
        const ws: any = sourceWallet;
        if (ws && typeof ws.connect === 'function') {
            try {
                await ws.connect();
                return;
            } catch (e) {
                console.error('[bridge] source connect failed:', e);
            }
        }
        openWalletPicker();
    }, [sourceWallet, openWalletPicker]);

    // ─── Route preview (IBC-only: output = input, ~30s, no fee) ────────────
    const routePreview = useMemo(() => {
        if (!selectedAsset || !amount || parseFloat(amount) <= 0) return undefined;
        return {
            estimatedOutput: amount,
            estimatedOutputTicker: selectedAsset.bzeAsset.ticker,
            estimatedDurationSeconds: 30,
            fees: [] as { amount: string; ticker: string; usdValue?: string }[],
            txsRequired: 1,
            mechanism: 'ibc' as const,
            warning: undefined,
            rawRoute: undefined,
        };
    }, [selectedAsset, amount]);

    // ─── Transfer ──────────────────────────────────────────────────────────
    const {executeTransfer, isExecuting, progressMessage} = useBridgeTransfer({
        direction: 'deposit',
        asset: selectedAsset,
        amount,
        routePreview,
    });

    // Balance gate
    const balanceAllowsTransfer = useMemo(() => {
        if (!sourceBalance) return false;
        if (sourceBalance.status === 'unsupported') return true;
        if (sourceBalance.status !== 'ready') return false;
        return sourceBalance.display.isGreaterThan(0);
    }, [sourceBalance]);

    const canExecute = useMemo(() => {
        return selectedAsset
            && amount !== ''
            && amountError === ''
            && routePreview !== undefined
            && !isExecuting
            && sourceWalletStatus === WalletState.Connected
            && balanceAllowsTransfer;
    }, [selectedAsset, amount, amountError, routePreview, isExecuting, sourceWalletStatus, balanceAllowsTransfer]);

    const handleExecute = useCallback(async () => {
        const success = await executeTransfer();
        if (success) {
            setAmount('');
            setSelectedAsset(undefined);
            setTimeout(() => refetchDepositBalance(), 4000);
            setTimeout(() => refetchDepositBalance(), 10000);
        }
    }, [executeTransfer, refetchDepositBalance]);

    // ─── Callbacks ─────────────────────────────────────────────────────────
    const onAssetChange = useCallback((denom: string) => {
        if (!denom) return;
        const asset = bridgeableAssets.find(a => a.bzeAsset.denom === denom);
        setSelectedAsset(asset);
        setAmount('');
        setAmountError('');
    }, [bridgeableAssets]);

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

    const sourceDisplayName = selectedAsset?.counterparty.displayName ?? '';

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

            {/* Empty state */}
            {!isLoadingAssets && bridgeableAssets.length === 0 && (
                <Box p="3" bg="fg.muted/5" borderRadius="md">
                    <Text fontSize="sm" color="fg.muted">
                        No depositable assets found. IBC assets will appear here once BeeZee
                        has active connections in the chain registry.
                    </Text>
                </Box>
            )}

            {/* Asset picker — flat list of all depositable assets */}
            {bridgeableAssets.length > 0 && (
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
                                <Select.ValueText placeholder="Select asset to deposit"/>
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
                                            <HStack gap="2" w="full" justify="space-between">
                                                <HStack gap="2">
                                                    <TokenLogo src={item.logo} symbol={item.label} size="16px"/>
                                                    <Text>{item.label}</Text>
                                                </HStack>
                                                <Text fontSize="xs" color="fg.muted">
                                                    {(item as any).chainDisplayName}
                                                </Text>
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

            {/* Source chain — auto-resolved, read-only */}
            {selectedAsset && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Source</Text>
                    <HStack
                        gap="2"
                        p="2"
                        borderWidth="1px"
                        borderColor={`${accentColor}.500/20`}
                        borderRadius="md"
                    >
                        <TokenLogo src={selectedAsset.counterparty.logo} symbol={sourceDisplayName} size="16px"/>
                        <Text fontSize="sm">{sourceDisplayName}</Text>
                    </HStack>
                </Box>
            )}

            {/* Transfer direction label */}
            {selectedAsset && (
                <Text fontSize="xs" color="fg.muted">
                    From {sourceDisplayName} → BeeZee
                </Text>
            )}

            {/* Amount input */}
            {selectedAsset && (
                <Box>
                    <Field.Root invalid={amountError !== ''}>
                        <Field.Label>Amount to deposit</Field.Label>
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

                    {/* Balance on source chain */}
                    {sourceBalance && (
                        <HStack justify="space-between" mt="1.5">
                            <Text fontSize="xs" color="fg.muted">
                                Available on {sourceDisplayName}
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
                            You have no {selectedAsset.bzeAsset.ticker} on {sourceDisplayName}.
                        </Text>
                    )}

                    {sourceBalance?.status === 'unsupported' && (
                        <Text fontSize="xs" color="fg.muted" mt="1">
                            We couldn&apos;t connect to {sourceDisplayName} to check your balance.
                            The transfer might still work — double-check in your wallet before signing.
                        </Text>
                    )}
                </Box>
            )}

            {/* Route preview */}
            {routePreview && amount && (
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
                            <Text fontSize="sm" color="fg.muted">You receive on BeeZee</Text>
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
                    </VStack>
                </Box>
            )}

            {/* Wallet connect prompt */}
            {selectedAsset && sourceWalletStatus !== WalletState.Connected && (
                <VStack gap="3">
                    <Text fontSize="sm" color="fg.muted">
                        Connect your wallet on {sourceDisplayName} to continue
                    </Text>
                    <Button size="sm" w="full" colorPalette={accentColor} onClick={handleConnectSource}>
                        Connect to {sourceDisplayName}
                    </Button>
                </VStack>
            )}

            {/* Execute */}
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
