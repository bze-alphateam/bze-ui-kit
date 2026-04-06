'use client'

import {useCallback, useMemo, useState} from 'react';
import {
    Badge,
    Box,
    Button,
    Field,
    Group,
    HStack,
    Input,
    Text,
    VStack,
} from '@chakra-ui/react';
import {LuX} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import {TokenLogo} from '../token-logo';
import {useSkipChains, type SkipChainWithStatus} from '../../hooks/useSkipChains';
import {useSkipAssets} from '../../hooks/useSkipAssets';
import {useBuyRoute} from '../../hooks/useBuyRoute';
import {useSkipBridgeTransfer} from '../../hooks/useSkipBridgeTransfer';
import {sanitizeNumberInput} from '../../utils/number';
import {formatDuration} from '../../utils/cross_chain';
import {prettyAmount} from '../../utils/amount';
import {getChainName, getChainByChainId} from '../../constants/chain';
import {BZE_SKIP_CHAIN_ID} from '../../constants/cross_chain';
import type {SkipAsset} from '../../types/cross_chain';

interface BuyFormProps {
    accentColor: string;
    onClose?: () => void;
}

export const BuyForm = ({accentColor, onClose}: BuyFormProps) => {
    const [selectedChain, setSelectedChain] = useState<SkipChainWithStatus | undefined>();
    const [selectedAsset, setSelectedAsset] = useState<SkipAsset | undefined>();
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');

    // Search filters
    const [chainSearch, setChainSearch] = useState('');
    const [assetSearch, setAssetSearch] = useState('');

    // ─── Data hooks ────────────────────────────────────────────────────────
    const {chains: skipChains, isLoading: isLoadingChains, error: chainsError} = useSkipChains();
    const {assets: skipAssets, isLoading: isLoadingAssets, error: assetsError} = useSkipAssets(selectedChain?.chain_id);
    const {routePreview, rawRoute, isLoading: isLoadingRoute, error: routeError} = useBuyRoute(
        selectedChain?.chain_id,
        selectedAsset?.denom,
        selectedAsset?.decimals,
        amount,
    );

    // ─── Filtered lists ────────────────────────────────────────────────────
    const filteredChains = useMemo(() => {
        const q = chainSearch.toLowerCase().trim();
        if (!q) return skipChains;
        return skipChains.filter(c =>
            (c.pretty_name || '').toLowerCase().includes(q) ||
            (c.chain_name || '').toLowerCase().includes(q),
        );
    }, [skipChains, chainSearch]);

    const filteredAssets = useMemo(() => {
        const q = assetSearch.toLowerCase().trim();
        if (!q) return skipAssets;
        return skipAssets.filter(a =>
            (a.symbol || '').toLowerCase().includes(q) ||
            (a.name || '').toLowerCase().includes(q),
        );
    }, [skipAssets, assetSearch]);

    // ─── Wallet connections ────────────────────────────────────────────────
    const sourceChainName = useMemo(() => {
        if (!selectedChain || !selectedChain.canSign) return getChainName();
        const registryChain = getChainByChainId(selectedChain.chain_id);
        return registryChain?.chainName ?? selectedChain.chain_name ?? getChainName();
    }, [selectedChain]);

    const {
        status: sourceWalletStatus,
        connect: openSourceWalletPicker,
        wallet: sourceWallet,
        address: sourceAddress,
    } = useChain(sourceChainName);

    const bzeChain = useChain(getChainName());

    const handleConnectSource = useCallback(async () => {
        const ws: any = sourceWallet;
        if (ws && typeof ws.connect === 'function') {
            try {
                await ws.connect();
                return;
            } catch (e) {
                console.error('[buy] source connect failed:', e);
            }
        }
        openSourceWalletPicker();
    }, [sourceWallet, openSourceWalletPicker]);

    // ─── Skip bridge transfer ──────────────────────────────────────────────
    const {executeSkipTransfer, isExecuting, progressMessage} = useSkipBridgeTransfer(sourceChainName);

    /**
     * Resolve wallet addresses for every chain in the Skip route. For the
     * source chain and BZE we already have addresses from `useChain`. For
     * intermediate chains (e.g. Osmosis in a cosmos→osmosis-swap→BZE route)
     * we ask Keplr directly — all Cosmos chains derive from the same key,
     * so `keplr.getKey(chainId)` returns the address without a separate
     * "connect" step.
     */
    const getAddressForChainId = useCallback(async (chainId: string): Promise<string | undefined> => {
        if (chainId === BZE_SKIP_CHAIN_ID || chainId === 'beezee-1') return bzeChain.address;
        if (selectedChain && chainId === selectedChain.chain_id) return sourceAddress;
        const resolved = getChainByChainId(chainId);
        if (resolved?.chainName === getChainName()) return bzeChain.address;

        // Intermediate chain — try Keplr directly
        try {
            const keplr = (window as any).keplr;
            if (keplr) {
                await keplr.enable(chainId);
                const key = await keplr.getKey(chainId);
                if (key?.bech32Address) return key.bech32Address;
            }
        } catch (e) {
            console.error(`[buy] could not get address for intermediate chain ${chainId}:`, e);
        }
        return undefined;
    }, [bzeChain.address, sourceAddress, selectedChain]);

    // ─── Execute ───────────────────────────────────────────────────────────
    const canExecute = useMemo(() => {
        return selectedChain?.canSign
            && selectedAsset
            && amount !== ''
            && amountError === ''
            && rawRoute
            && rawRoute.txs_required <= 1
            && !isExecuting
            && !isLoadingRoute
            && sourceWalletStatus === WalletState.Connected
            && bzeChain.address;
    }, [selectedChain, selectedAsset, amount, amountError, rawRoute, isExecuting, isLoadingRoute, sourceWalletStatus, bzeChain.address]);

    const handleExecute = useCallback(async () => {
        if (!rawRoute) return;
        const result = await executeSkipTransfer(rawRoute, getAddressForChainId);
        if (result.success) {
            setAmount('');
            setSelectedAsset(undefined);
            setSelectedChain(undefined);
            setChainSearch('');
            setAssetSearch('');
        } else if (result.error) {
            setAmountError(result.error);
        }
    }, [rawRoute, executeSkipTransfer, getAddressForChainId]);

    // ─── Callbacks ─────────────────────────────────────────────────────────
    const onChainSelect = useCallback((chain: SkipChainWithStatus) => {
        if (!chain.canSign) return;
        setSelectedChain(chain);
        setSelectedAsset(undefined);
        setAmount('');
        setAmountError('');
        setChainSearch('');
        setAssetSearch('');
    }, []);

    const onAssetSelect = useCallback((asset: SkipAsset) => {
        setSelectedAsset(asset);
        setAmount('');
        setAmountError('');
        setAssetSearch('');
    }, []);

    const onAmountChange = useCallback((value: string) => {
        setAmount(sanitizeNumberInput(value));
        setAmountError('');
    }, []);

    const sourceDisplayName = selectedChain?.pretty_name || selectedChain?.chain_name || '';

    const feeDisplay = useMemo(() => {
        if (!routePreview || routePreview.fees.length === 0) return undefined;
        return routePreview.fees
            .map(f => (f.usdValue ? `$${prettyAmount(f.usdValue)}` : `${f.amount} ${f.ticker}`))
            .join(' + ');
    }, [routePreview]);

    return (
        <VStack gap="4" align="stretch">
            {/* Header */}
            <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="medium">Buy BZE</Text>
                {onClose && (
                    <Button size="xs" variant="ghost" onClick={onClose}>
                        <LuX size="14"/>
                    </Button>
                )}
            </HStack>

            <Text fontSize="sm" color="fg.muted">
                Swap assets from other networks to BZE
            </Text>

            {/* Chain picker */}
            {chainsError && <Text fontSize="sm" color="red.500">{chainsError}</Text>}

            {!selectedChain && !isLoadingChains && skipChains.length > 0 && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Pay with assets from</Text>
                    <Input
                        size="sm"
                        placeholder="Search network..."
                        value={chainSearch}
                        onChange={(e) => setChainSearch(e.target.value)}
                        mb="2"
                    />
                    <Box
                        maxH="200px"
                        overflowY="auto"
                        borderWidth="1px"
                        borderColor={`${accentColor}.500/20`}
                        borderRadius="md"
                    >
                        {filteredChains.map(c => (
                            <HStack
                                key={c.chain_id}
                                gap="2"
                                px="3"
                                py="1.5"
                                cursor={c.canSign ? "pointer" : "not-allowed"}
                                opacity={c.canSign ? 1 : 0.5}
                                _hover={c.canSign ? {bg: `${accentColor}.500/10`} : {}}
                                onClick={() => onChainSelect(c)}
                                justify="space-between"
                            >
                                <HStack gap="2">
                                    <TokenLogo src={c.logo_uri || ''} symbol={c.pretty_name || c.chain_name || '?'} size="16px"/>
                                    <Text fontSize="sm">{c.pretty_name || c.chain_name}</Text>
                                </HStack>
                                {!c.canSign && (
                                    <Badge size="xs" variant="subtle" colorPalette="gray">Soon</Badge>
                                )}
                            </HStack>
                        ))}
                        {filteredChains.length === 0 && (
                            <Text fontSize="xs" color="fg.muted" p="3">No chains match your search</Text>
                        )}
                    </Box>
                </Box>
            )}

            {isLoadingChains && (
                <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                    <Text fontSize="xs" color="fg.muted">Loading available networks...</Text>
                    <Box h="3" w="70%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                    <Box h="3" w="50%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                    <Box h="3" w="60%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                </VStack>
            )}

            {/* Selected chain display + change button */}
            {selectedChain && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Network</Text>
                    <HStack
                        gap="2"
                        p="2"
                        borderWidth="1px"
                        borderColor={`${accentColor}.500/20`}
                        borderRadius="md"
                        justify="space-between"
                    >
                        <HStack gap="2">
                            <TokenLogo src={selectedChain.logo_uri || ''} symbol={sourceDisplayName} size="16px"/>
                            <Text fontSize="sm">{sourceDisplayName}</Text>
                        </HStack>
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                                setSelectedChain(undefined);
                                setSelectedAsset(undefined);
                                setAmount('');
                                setAmountError('');
                            }}
                        >
                            Change
                        </Button>
                    </HStack>
                </Box>
            )}

            {/* Asset picker */}
            {selectedChain && !selectedAsset && (
                <Box>
                    {isLoadingAssets && (
                        <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                            <Text fontSize="xs" color="fg.muted">Loading assets on {sourceDisplayName}...</Text>
                            <Box h="3" w="60%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                            <Box h="3" w="45%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                            <Box h="3" w="55%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                        </VStack>
                    )}
                    {assetsError && <Text fontSize="sm" color="red.500">{assetsError}</Text>}
                    {!isLoadingAssets && skipAssets.length > 0 && (
                        <>
                            <Text fontSize="xs" fontWeight="medium" mb="1">Asset to swap</Text>
                            <Input
                                size="sm"
                                placeholder="Search asset..."
                                value={assetSearch}
                                onChange={(e) => setAssetSearch(e.target.value)}
                                mb="2"
                            />
                            <Box
                                maxH="200px"
                                overflowY="auto"
                                borderWidth="1px"
                                borderColor={`${accentColor}.500/20`}
                                borderRadius="md"
                            >
                                {filteredAssets.map(a => (
                                    <HStack
                                        key={a.denom}
                                        gap="2"
                                        px="3"
                                        py="1.5"
                                        cursor="pointer"
                                        _hover={{bg: `${accentColor}.500/10`}}
                                        onClick={() => onAssetSelect(a)}
                                    >
                                        <TokenLogo src={a.logo_uri || ''} symbol={a.symbol || '?'} size="16px"/>
                                        <Text fontSize="sm">{a.symbol}</Text>
                                        <Text fontSize="xs" color="fg.muted">{a.name}</Text>
                                    </HStack>
                                ))}
                                {filteredAssets.length === 0 && (
                                    <Text fontSize="xs" color="fg.muted" p="3">No assets match your search</Text>
                                )}
                            </Box>
                        </>
                    )}
                </Box>
            )}

            {/* Selected asset display + change button */}
            {selectedAsset && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Asset</Text>
                    <HStack
                        gap="2"
                        p="2"
                        borderWidth="1px"
                        borderColor={`${accentColor}.500/20`}
                        borderRadius="md"
                        justify="space-between"
                    >
                        <HStack gap="2">
                            <TokenLogo src={selectedAsset.logo_uri || ''} symbol={selectedAsset.symbol || '?'} size="16px"/>
                            <Text fontSize="sm">{selectedAsset.symbol}</Text>
                            <Text fontSize="xs" color="fg.muted">{selectedAsset.name}</Text>
                        </HStack>
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                                setSelectedAsset(undefined);
                                setAmount('');
                                setAmountError('');
                            }}
                        >
                            Change
                        </Button>
                    </HStack>
                </Box>
            )}

            {/* Amount input */}
            {selectedChain && selectedAsset && (
                <Box>
                    <Field.Root invalid={amountError !== ''}>
                        <Field.Label>Amount to swap</Field.Label>
                        <Group attached w="full">
                            <Input
                                size="sm"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => onAmountChange(e.target.value)}
                            />
                        </Group>
                        <Field.ErrorText>{amountError}</Field.ErrorText>
                    </Field.Root>
                </Box>
            )}

            {/* Route preview */}
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
                                {routePreview.estimatedOutput} BZE
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

            {/* Loading route */}
            {isLoadingRoute && amount && (
                <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                    <Text fontSize="xs" color="fg.muted">Finding the best route to BZE...</Text>
                    <Box h="3" w="65%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                    <Box h="3" w="45%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                </VStack>
            )}

            {/* Route error */}
            {routeError && amount && !isLoadingRoute && (
                <Text fontSize="sm" color="red.500">{routeError}</Text>
            )}

            {/* Multi-tx warning */}
            {rawRoute && rawRoute.txs_required > 1 && (
                <Box p="3" bg="orange.500/10" borderRadius="md" borderWidth="1px" borderColor="orange.500/30">
                    <Text fontSize="sm" color="orange.600">
                        This route requires multiple steps and is not supported yet. Try a different asset or amount.
                    </Text>
                </Box>
            )}

            {/* Wallet connect prompt */}
            {selectedChain?.canSign && selectedAsset && sourceWalletStatus !== WalletState.Connected && (
                <VStack gap="3">
                    <Text fontSize="sm" color="fg.muted">
                        Connect your wallet on {sourceDisplayName} to continue
                    </Text>
                    <Button size="sm" w="full" colorPalette={accentColor} onClick={handleConnectSource}>
                        Connect to {sourceDisplayName}
                    </Button>
                </VStack>
            )}

            {/* Execute button */}
            <Button
                size="sm"
                w="full"
                colorPalette={accentColor}
                disabled={!canExecute}
                loading={isExecuting}
                loadingText={progressMessage || "Swapping..."}
                onClick={handleExecute}
            >
                Buy BZE
            </Button>
        </VStack>
    );
};
