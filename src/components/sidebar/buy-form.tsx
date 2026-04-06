'use client'

import {useCallback, useEffect, useMemo, useState} from 'react';
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
import {prettyAmount, uAmountToBigNumberAmount} from '../../utils/amount';
import {getChainName, getChainByChainId} from '../../constants/chain';
import {getChainRestURL} from '../../constants/endpoints';
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
    const [chainSearch, setChainSearch] = useState('');
    const [assetSearch, setAssetSearch] = useState('');

    // Balances fetched after wallet connections are approved
    const [assetBalances, setAssetBalances] = useState<Map<string, string>>(new Map());
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);

    // Wallet connection state for all required chains
    const [allChainsConnected, setAllChainsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // ─── Data hooks ────────────────────────────────────────────────────────
    const {chains: skipChains, isLoading: isLoadingChains, error: chainsError} = useSkipChains();
    const {assets: skipAssets, isLoading: isLoadingAssets, error: assetsError} = useSkipAssets(selectedChain?.chain_id);
    const {routePreview, rawRoute, isLoading: isLoadingRoute, error: routeError} = useBuyRoute(
        selectedChain?.chain_id,
        selectedAsset?.denom,
        selectedAsset?.decimals,
        amount,
    );

    // ─── Wallet connections ────────────────────────────────────────────────
    const sourceChainName = useMemo(() => {
        if (!selectedChain || !selectedChain.canSign) return getChainName();
        const registryChain = getChainByChainId(selectedChain.chain_id);
        return registryChain?.chainName ?? selectedChain.chain_name ?? getChainName();
    }, [selectedChain]);

    const {
        status: sourceWalletStatus,
        address: sourceAddress,
    } = useChain(sourceChainName);

    const bzeChain = useChain(getChainName());

    // ─── Required chains from route ────────────────────────────────────────
    const requiredChainIds = useMemo<string[]>(() => {
        if (!rawRoute?.required_chain_addresses) return [];
        return rawRoute.required_chain_addresses;
    }, [rawRoute]);

    const requiredChainNames = useMemo(() => {
        return requiredChainIds.map(cid => {
            const chain = getChainByChainId(cid);
            return chain?.prettyName ?? chain?.chainName ?? cid;
        });
    }, [requiredChainIds]);

    // Reset connection state when route changes
    useEffect(() => {
        setAllChainsConnected(false);
    }, [rawRoute]);

    // Check if source wallet is connected (for balance fetch after approval)
    const sourceConnected = selectedChain?.canSign && sourceWalletStatus === WalletState.Connected;

    // ─── Connect all required chains at once ───────────────────────────────
    const handleConnectAll = useCallback(async () => {
        setIsConnecting(true);
        try {
            const keplr = (window as any).keplr;
            if (!keplr) {
                setIsConnecting(false);
                return;
            }
            // Enable all required chains in one go
            for (const chainId of requiredChainIds) {
                await keplr.enable(chainId);
            }
            setAllChainsConnected(true);
        } catch (e) {
            console.error('[buy] connect chains failed:', e);
        } finally {
            setIsConnecting(false);
        }
    }, [requiredChainIds]);

    // ─── Fetch balances once all chains connected ──────────────────────────
    useEffect(() => {
        if (!allChainsConnected || !selectedChain || !sourceAddress) return;

        let cancelled = false;
        setIsLoadingBalances(true);

        (async () => {
            const chainName = getChainByChainId(selectedChain.chain_id)?.chainName ?? selectedChain.chain_name ?? '';
            const restUrl = await getChainRestURL(chainName);
            if (cancelled || !restUrl) {
                setIsLoadingBalances(false);
                return;
            }
            try {
                const res = await fetch(`${restUrl}/cosmos/bank/v1beta1/balances/${sourceAddress}?pagination.limit=500`);
                if (!res.ok) throw new Error(`REST ${res.status}`);
                const data = await res.json();
                const balances: Array<{ denom: string; amount: string }> = data?.balances ?? [];
                const map = new Map<string, string>();
                for (const b of balances) {
                    if (b.amount && b.amount !== '0') map.set(b.denom, b.amount);
                }
                if (!cancelled) setAssetBalances(map);
            } catch {
                // Non-critical — form works without balances
            } finally {
                if (!cancelled) setIsLoadingBalances(false);
            }
        })();

        return () => { cancelled = true; };
    }, [allChainsConnected, selectedChain, sourceAddress]);

    // ─── Assets enriched with balances, sorted: with balance on top ────────
    const assetsWithBalances = useMemo(() => {
        return skipAssets.map(a => ({
            ...a,
            balanceRaw: assetBalances.get(a.denom),
            balanceDisplay: assetBalances.get(a.denom) && a.decimals
                ? prettyAmount(uAmountToBigNumberAmount(assetBalances.get(a.denom)!, a.decimals))
                : undefined,
        })).sort((a, b) => {
            const aHas = a.balanceRaw ? 1 : 0;
            const bHas = b.balanceRaw ? 1 : 0;
            if (aHas !== bHas) return bHas - aHas;
            return (a.symbol || '').localeCompare(b.symbol || '');
        });
    }, [skipAssets, assetBalances]);

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
        if (!q) return assetsWithBalances;
        return assetsWithBalances.filter(a =>
            (a.symbol || '').toLowerCase().includes(q) ||
            (a.name || '').toLowerCase().includes(q),
        );
    }, [assetsWithBalances, assetSearch]);

    // ─── Skip bridge transfer ──────────────────────────────────────────────
    const {executeSkipTransfer, isExecuting, progressMessage} = useSkipBridgeTransfer(sourceChainName);

    const getAddressForChainId = useCallback(async (chainId: string): Promise<string | undefined> => {
        if (chainId === BZE_SKIP_CHAIN_ID || chainId === 'beezee-1') return bzeChain.address;
        if (selectedChain && chainId === selectedChain.chain_id) return sourceAddress;
        const resolved = getChainByChainId(chainId);
        if (resolved?.chainName === getChainName()) return bzeChain.address;
        try {
            const keplr = (window as any).keplr;
            if (keplr) {
                const key = await keplr.getKey(chainId);
                if (key?.bech32Address) return key.bech32Address;
            }
        } catch (e) {
            console.error(`[buy] could not get address for chain ${chainId}:`, e);
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
            && allChainsConnected
            && bzeChain.address;
    }, [selectedChain, selectedAsset, amount, amountError, rawRoute, isExecuting, isLoadingRoute, allChainsConnected, bzeChain.address]);

    const handleExecute = useCallback(async () => {
        if (!rawRoute) return;
        const result = await executeSkipTransfer(rawRoute, getAddressForChainId);
        if (result.success) {
            setAmount('');
            setSelectedAsset(undefined);
            setSelectedChain(undefined);
            setChainSearch('');
            setAssetSearch('');
            setAssetBalances(new Map());
            setAllChainsConnected(false);
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
        setAssetBalances(new Map());
        setAllChainsConnected(false);
    }, []);

    const onAssetSelect = useCallback((asset: SkipAsset) => {
        setSelectedAsset(asset);
        setAmount('');
        setAmountError('');
        setAssetSearch('');
        setAllChainsConnected(false);
    }, []);

    const onAmountChange = useCallback((value: string) => {
        setAmount(sanitizeNumberInput(value));
        setAmountError('');
    }, []);

    const setMaxAmount = useCallback(() => {
        if (!selectedAsset || !selectedAsset.decimals) return;
        const raw = assetBalances.get(selectedAsset.denom);
        if (!raw) return;
        setAmount(uAmountToBigNumberAmount(raw, selectedAsset.decimals).toString());
        setAmountError('');
    }, [selectedAsset, assetBalances]);

    const sourceDisplayName = selectedChain?.pretty_name || selectedChain?.chain_name || '';

    const feeDisplay = useMemo(() => {
        if (!routePreview || routePreview.fees.length === 0) return undefined;
        return routePreview.fees
            .map(f => (f.usdValue ? `$${prettyAmount(f.usdValue)}` : `${f.amount} ${f.ticker}`))
            .join(' + ');
    }, [routePreview]);

    // Whether we need the connect step (route loaded, not yet connected)
    const needsConnect = rawRoute && rawRoute.txs_required <= 1 && requiredChainIds.length > 0 && !allChainsConnected;

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

            {/* ── Chain picker ──────────────────────────────────────────────── */}
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
                    <Box maxH="200px" overflowY="auto" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md">
                        {filteredChains.map(c => (
                            <HStack
                                key={c.chain_id} gap="2" px="3" py="1.5"
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
                                {!c.canSign && <Badge size="xs" variant="subtle" colorPalette="gray">Soon</Badge>}
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

            {/* Selected chain */}
            {selectedChain && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Network</Text>
                    <HStack gap="2" p="2" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md" justify="space-between">
                        <HStack gap="2">
                            <TokenLogo src={selectedChain.logo_uri || ''} symbol={sourceDisplayName} size="16px"/>
                            <Text fontSize="sm">{sourceDisplayName}</Text>
                        </HStack>
                        <Button size="xs" variant="ghost" onClick={() => {
                            setSelectedChain(undefined); setSelectedAsset(undefined);
                            setAmount(''); setAmountError(''); setAssetBalances(new Map());
                            setAllChainsConnected(false);
                        }}>Change</Button>
                    </HStack>
                </Box>
            )}

            {/* ── Asset picker ──────────────────────────────────────────────── */}
            {selectedChain && !selectedAsset && (
                <Box>
                    {isLoadingAssets && (
                        <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                            <Text fontSize="xs" color="fg.muted">Loading assets on {sourceDisplayName}...</Text>
                            <Box h="3" w="60%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                            <Box h="3" w="45%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                        </VStack>
                    )}
                    {assetsError && <Text fontSize="sm" color="red.500">{assetsError}</Text>}
                    {!isLoadingAssets && assetsWithBalances.length > 0 && (
                        <>
                            <Text fontSize="xs" fontWeight="medium" mb="1">Asset to swap</Text>
                            <Input
                                size="sm" placeholder="Search asset..."
                                value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} mb="2"
                            />
                            <Box maxH="200px" overflowY="auto" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md">
                                {filteredAssets.map(a => (
                                    <HStack
                                        key={a.denom} gap="2" px="3" py="1.5"
                                        cursor="pointer" _hover={{bg: `${accentColor}.500/10`}}
                                        onClick={() => onAssetSelect(a)} justify="space-between"
                                    >
                                        <HStack gap="2">
                                            <TokenLogo src={a.logo_uri || ''} symbol={a.symbol || '?'} size="16px"/>
                                            <Text fontSize="sm">{a.symbol}</Text>
                                        </HStack>
                                        {(a as any).balanceDisplay ? (
                                            <Text fontSize="xs" fontFamily="mono" color="fg.muted">{(a as any).balanceDisplay}</Text>
                                        ) : (
                                            <Text fontSize="xs" color="fg.muted">{a.name}</Text>
                                        )}
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

            {/* Selected asset */}
            {selectedAsset && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Asset</Text>
                    <HStack gap="2" p="2" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md" justify="space-between">
                        <HStack gap="2">
                            <TokenLogo src={selectedAsset.logo_uri || ''} symbol={selectedAsset.symbol || '?'} size="16px"/>
                            <Text fontSize="sm">{selectedAsset.symbol}</Text>
                        </HStack>
                        <Button size="xs" variant="ghost" onClick={() => {
                            setSelectedAsset(undefined); setAmount(''); setAmountError('');
                            setAllChainsConnected(false);
                        }}>Change</Button>
                    </HStack>
                </Box>
            )}

            {/* ── Amount input (works without wallet) ───────────────────────── */}
            {selectedChain && selectedAsset && (
                <Box>
                    <Field.Root invalid={amountError !== ''}>
                        <Field.Label>Amount to swap</Field.Label>
                        <Group attached w="full">
                            <Input size="sm" placeholder="0.00" value={amount}
                                   onChange={(e) => onAmountChange(e.target.value)}/>
                            {assetBalances.get(selectedAsset.denom) && (
                                <Button variant="outline" size="sm" onClick={setMaxAmount}>Max</Button>
                            )}
                        </Group>
                        <Field.ErrorText>{amountError}</Field.ErrorText>
                    </Field.Root>

                    {/* Balance (shown after wallet connected) */}
                    {allChainsConnected && isLoadingBalances && (
                        <Text fontSize="xs" color="fg.muted" mt="1.5">Fetching your balance...</Text>
                    )}
                    {allChainsConnected && !isLoadingBalances && assetBalances.get(selectedAsset.denom) && selectedAsset.decimals && (
                        <HStack justify="space-between" mt="1.5">
                            <Text fontSize="xs" color="fg.muted">Available on {sourceDisplayName}</Text>
                            <Text fontSize="xs" fontFamily="mono">
                                {prettyAmount(uAmountToBigNumberAmount(assetBalances.get(selectedAsset.denom)!, selectedAsset.decimals))} {selectedAsset.symbol}
                            </Text>
                        </HStack>
                    )}
                </Box>
            )}

            {/* ── Route preview (works without wallet) ──────────────────────── */}
            {routePreview && amount && !isLoadingRoute && (
                <Box
                    p="3" bgGradient="to-br"
                    gradientFrom={`${accentColor}.500/8`} gradientTo={`${accentColor}.600/8`}
                    borderRadius="md" borderWidth="1px" borderColor={`${accentColor}.500/20`}
                >
                    <VStack gap="2" align="stretch">
                        <HStack justify="space-between">
                            <Text fontSize="sm" color="fg.muted">You receive</Text>
                            <Text fontSize="sm" fontWeight="medium" fontFamily="mono">{routePreview.estimatedOutput} BZE</Text>
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

            {isLoadingRoute && amount && (
                <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                    <Text fontSize="xs" color="fg.muted">Finding the best route to BZE...</Text>
                    <Box h="3" w="65%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                    <Box h="3" w="45%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                </VStack>
            )}

            {routeError && amount && !isLoadingRoute && (
                <Text fontSize="sm" color="red.500">{routeError}</Text>
            )}

            {rawRoute && rawRoute.txs_required > 1 && (
                <Box p="3" bg="orange.500/10" borderRadius="md" borderWidth="1px" borderColor="orange.500/30">
                    <Text fontSize="sm" color="orange.600">
                        This route requires multiple steps and is not supported yet. Try a different asset or amount.
                    </Text>
                </Box>
            )}

            {/* ── Connect wallets (shown instead of Buy when not connected) ── */}
            {needsConnect && (
                <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                    <Text fontSize="sm" color="fg.muted">
                        To complete this swap, your wallet needs access to{' '}
                        <Text as="span" fontWeight="medium">{requiredChainNames.join(', ')}</Text>.
                        This lets us sign and route the transaction on your behalf.
                    </Text>
                    <Button
                        size="sm" w="full" colorPalette={accentColor}
                        onClick={handleConnectAll}
                        loading={isConnecting}
                        loadingText="Connecting..."
                    >
                        Approve connections
                    </Button>
                </VStack>
            )}

            {/* ── Buy BZE button (only after all connections approved) ──────── */}
            {(!needsConnect) && (
                <Button
                    size="sm" w="full" colorPalette={accentColor}
                    disabled={!canExecute}
                    loading={isExecuting}
                    loadingText={progressMessage || "Swapping..."}
                    onClick={handleExecute}
                >
                    Buy BZE
                </Button>
            )}
        </VStack>
    );
};
