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
import {
    useWithdrawableBalances,
    type WithdrawableAsset,
    type WithdrawDestinationChain,
} from '../../hooks/useWithdrawableBalances';
import {useBridgeTransfer} from '../../hooks/useBridgeTransfer';
import {sanitizeNumberInput} from '../../utils/number';
import {prettyAmount, uAmountToBigNumberAmount} from '../../utils/amount';
import {formatDuration} from '../../utils/cross_chain';

interface WithdrawFormProps {
    accentColor: string;
}

/**
 * Withdraw flow: send an asset from BeeZee to another chain.
 *
 * Rules:
 *   • The picker shows every non-LP balance with amount > 0.
 *   • IBC vouchers lock the destination to their origin (the direct
 *     counterparty from the IBC trace). Prevents footguns like redirecting
 *     an AtomOne voucher to Osmosis.
 *   • BZE-native + factory tokens can go anywhere BZE has an IBC channel.
 *     Osmosis is pre-selected as default.
 */
export const WithdrawForm = ({accentColor}: WithdrawFormProps) => {
    const [selectedAsset, setSelectedAsset] = useState<WithdrawableAsset | undefined>();
    const [selectedDestination, setSelectedDestination] = useState<WithdrawDestinationChain | undefined>();
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');

    const {assets: withdrawableAssets, isLoading: isLoadingAssets} = useWithdrawableBalances();

    // ─── Asset picker collection ───────────────────────────────────────────
    const assetsCollection = useMemo(() => {
        return createListCollection({
            items: withdrawableAssets.map(wa => ({
                label: wa.balance.ticker,
                value: wa.balance.denom,
                logo: wa.balance.logo,
                displayName: wa.balance.name,
                displayAmount: prettyAmount(uAmountToBigNumberAmount(wa.balance.amount, wa.balance.decimals)),
            })),
        });
    }, [withdrawableAssets]);

    // ─── Destination picker collection (only for open-destination assets) ──
    const destinationsCollection = useMemo(() => {
        if (!selectedAsset || selectedAsset.isDestinationLocked) {
            return createListCollection({items: []});
        }
        return createListCollection({
            items: selectedAsset.destinations.map(d => ({
                label: d.displayName,
                value: d.chainName,
                logo: d.logo,
            })),
        });
    }, [selectedAsset]);

    // Auto-set destination when the asset changes
    useEffect(() => {
        if (!selectedAsset) {
            setSelectedDestination(undefined);
            return;
        }
        setSelectedDestination(selectedAsset.defaultDestination);
    }, [selectedAsset]);

    // ─── Counterparty wallet ───────────────────────────────────────────────
    const destChainName = selectedDestination?.chainName ?? 'beezee';
    const {
        status: destWalletStatus,
        connect: openWalletPicker,
        wallet: destWallet,
    } = useChain(destChainName);

    const handleConnectDest = useCallback(async () => {
        const ws: any = destWallet;
        if (ws && typeof ws.connect === 'function') {
            try {
                await ws.connect();
                return;
            } catch (e) {
                console.error('[bridge] dest connect failed:', e);
            }
        }
        openWalletPicker();
    }, [destWallet, openWalletPicker]);

    // ─── Transfer ──────────────────────────────────────────────────────────
    // Simple IBC route preview — same shape as deposit, just echoes the
    // amount back with ~30s and no fee.
    const routePreview = useMemo(() => {
        if (!selectedAsset || !amount || parseFloat(amount) <= 0) return undefined;
        return {
            estimatedOutput: amount,
            estimatedOutputTicker: selectedAsset.balance.ticker,
            estimatedDurationSeconds: 30,
            fees: [] as { amount: string; ticker: string; usdValue?: string }[],
            txsRequired: 1,
            mechanism: 'ibc' as const,
            warning: undefined,
            rawRoute: undefined,
        };
    }, [selectedAsset, amount]);

    const {executeTransfer, isExecuting, progressMessage} = useBridgeTransfer({
        direction: 'withdraw',
        asset: selectedAsset,
        destination: selectedDestination,
        amount,
        routePreview,
    });

    // ─── Withdraw-side source balance (already known — it's a BZE balance) ─
    const sourceBalance = useMemo(() => {
        if (!selectedAsset) return undefined;
        return {
            display: uAmountToBigNumberAmount(selectedAsset.balance.amount, selectedAsset.balance.decimals),
            decimals: selectedAsset.balance.decimals,
            status: 'ready' as const,
        };
    }, [selectedAsset]);

    const canExecute = useMemo(() => {
        return selectedAsset
            && selectedDestination
            && amount !== ''
            && amountError === ''
            && !isExecuting
            && destWalletStatus === WalletState.Connected
            && sourceBalance
            && sourceBalance.display.isGreaterThan(0);
    }, [selectedAsset, selectedDestination, amount, amountError, isExecuting, destWalletStatus, sourceBalance]);

    const handleExecute = useCallback(async () => {
        const success = await executeTransfer();
        if (success) {
            setAmount('');
            setSelectedAsset(undefined);
            setSelectedDestination(undefined);
        }
    }, [executeTransfer]);

    // ─── Callbacks ─────────────────────────────────────────────────────────
    const onAssetChange = useCallback((denom: string) => {
        if (!denom) return;
        const asset = withdrawableAssets.find(a => a.balance.denom === denom);
        setSelectedAsset(asset);
        setAmount('');
        setAmountError('');
    }, [withdrawableAssets]);

    const onDestinationChange = useCallback((chainName: string) => {
        if (!chainName || !selectedAsset) return;
        const dest = selectedAsset.destinations.find(d => d.chainName === chainName);
        setSelectedDestination(dest);
    }, [selectedAsset]);

    const onAmountChange = useCallback((value: string) => {
        setAmount(sanitizeNumberInput(value));
        setAmountError('');
    }, []);

    const setMaxAmount = useCallback(() => {
        if (!sourceBalance) return;
        setAmount(sourceBalance.display.toString());
        setAmountError('');
    }, [sourceBalance]);

    const validateAmount = useCallback(() => {
        if (!amount || !sourceBalance) return;
        if (sourceBalance.display.isLessThan(amount)) {
            setAmountError('Insufficient balance');
        }
    }, [amount, sourceBalance]);

    const destDisplayName = selectedDestination?.displayName ?? '';

    return (
        <VStack gap="4" align="stretch">
            <Text fontSize="sm" color="fg.muted">
                Send assets from BeeZee to other networks
            </Text>

            {/* Empty state */}
            {!isLoadingAssets && withdrawableAssets.length === 0 && (
                <Box p="3" bg="fg.muted/5" borderRadius="md">
                    <Text fontSize="sm" color="fg.muted">
                        You don&apos;t have any assets that can be sent to another chain right now.
                    </Text>
                </Box>
            )}

            {/* Asset picker — shows user's BZE balances (non-LP, non-zero) */}
            {withdrawableAssets.length > 0 && (
                <Box>
                    <Select.Root
                        collection={assetsCollection}
                        size="sm"
                        value={selectedAsset ? [selectedAsset.balance.denom] : []}
                        onValueChange={(details) => onAssetChange(details.value[0] || '')}
                    >
                        <Select.Label>Asset</Select.Label>
                        <Select.HiddenSelect/>
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder="Select asset to send"/>
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
                                                <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                                                    {(item as any).displayAmount}
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

            {/* Destination — locked for IBC vouchers, picker for native/factory */}
            {selectedAsset && selectedAsset.isDestinationLocked && selectedDestination && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Destination</Text>
                    <HStack
                        gap="2"
                        p="2"
                        borderWidth="1px"
                        borderColor={`${accentColor}.500/20`}
                        borderRadius="md"
                    >
                        <TokenLogo src={selectedDestination.logo} symbol={destDisplayName} size="16px"/>
                        <Text fontSize="sm">{destDisplayName}</Text>
                    </HStack>
                </Box>
            )}

            {selectedAsset && !selectedAsset.isDestinationLocked && (
                <Box>
                    <Select.Root
                        collection={destinationsCollection}
                        size="sm"
                        value={selectedDestination ? [selectedDestination.chainName] : []}
                        onValueChange={(details) => onDestinationChange(details.value[0] || '')}
                    >
                        <Select.Label>Destination</Select.Label>
                        <Select.HiddenSelect/>
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder="Select destination"/>
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator/>
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {destinationsCollection.items.map((item) => (
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

            {/* Transfer direction label */}
            {selectedAsset && selectedDestination && (
                <Text fontSize="xs" color="fg.muted">
                    From BeeZee → {destDisplayName}
                </Text>
            )}

            {/* Amount input */}
            {selectedAsset && selectedDestination && (
                <Box>
                    <Field.Root invalid={amountError !== ''}>
                        <Field.Label>Amount to send</Field.Label>
                        <Group attached w="full">
                            <Input
                                size="sm"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => onAmountChange(e.target.value)}
                                onBlur={validateAmount}
                            />
                            <Button variant="outline" size="sm" onClick={setMaxAmount}>
                                Max
                            </Button>
                        </Group>
                        <Field.ErrorText>{amountError}</Field.ErrorText>
                    </Field.Root>

                    {sourceBalance && (
                        <HStack justify="space-between" mt="1.5">
                            <Text fontSize="xs" color="fg.muted">Available on BeeZee</Text>
                            <Text fontSize="xs" fontFamily="mono">
                                {prettyAmount(sourceBalance.display)} {selectedAsset.balance.ticker}
                            </Text>
                        </HStack>
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
                            <Text fontSize="sm" color="fg.muted">Recipient gets</Text>
                            <Text fontSize="sm" fontWeight="medium" fontFamily="mono">
                                {routePreview.estimatedOutput} {routePreview.estimatedOutputTicker}
                            </Text>
                        </HStack>
                        <HStack justify="space-between">
                            <Text fontSize="xs" color="fg.muted">Estimated time</Text>
                            <Text fontSize="xs">{formatDuration(routePreview.estimatedDurationSeconds)}</Text>
                        </HStack>
                    </VStack>
                </Box>
            )}

            {/* Wallet connect prompt */}
            {selectedDestination && destWalletStatus !== WalletState.Connected && (
                <VStack gap="3">
                    <Text fontSize="sm" color="fg.muted">
                        Connect your wallet on {destDisplayName} to receive funds
                    </Text>
                    <Button size="sm" w="full" colorPalette={accentColor} onClick={handleConnectDest}>
                        Connect to {destDisplayName}
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
