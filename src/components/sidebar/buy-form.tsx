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
import {LuX, LuInfo} from 'react-icons/lu';
import {Tooltip} from '../tooltip';
import {useChain, useWalletManager} from '@interchain-kit/react';
import {TokenLogo} from '../token-logo';
import {useSkipChains, type SkipChainWithStatus} from '../../hooks/useSkipChains';
import {useSkipAssets} from '../../hooks/useSkipAssets';
import {useBuyRoute} from '../../hooks/useBuyRoute';
import {useSkipBridgeTransfer} from '../../hooks/useSkipBridgeTransfer';
import {useEvmWalletState} from '../../evm/context';
import {useEvmWallet} from '../../hooks/useEvmWallet';
import {sanitizeNumberInput} from '../../utils/number';
import {formatDuration} from '../../utils/cross_chain';
import {prettyAmount, uAmountToBigNumberAmount, toBigNumber} from '../../utils/amount';
import {shortNumberFormat} from '../../utils/formatter';
import {getChainName, getChainByChainId, getWalletChainsNames, getChains, getAssetLists} from '../../constants/chain';
import {getChainRestURL} from '../../constants/endpoints';
import {BZE_SKIP_CHAIN_ID} from '../../constants/cross_chain';
import {skipChainIdToEvmChainId} from '../../utils/evm';
import type {UseSkipTxTrackerReturn} from '../../hooks/useSkipTxTracker';
import {useToast} from '../../hooks/useToast';
import type {SkipAsset} from '../../types/cross_chain';

/** SkipAsset enriched with optional balance data from the source chain. */
interface SkipAssetWithBalance extends SkipAsset {
    balanceRaw?: string;
    balanceDisplay?: string;
}

interface BuyFormProps {
    accentColor: string;
    onClose?: () => void;
    addTransaction?: UseSkipTxTrackerReturn['addTransaction'];
}

export const BuyForm = ({accentColor, onClose, addTransaction}: BuyFormProps) => {
    const [selectedChain, setSelectedChain] = useState<SkipChainWithStatus | undefined>();
    const [selectedAsset, setSelectedAsset] = useState<SkipAsset | undefined>();
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');
    const [chainSearch, setChainSearch] = useState('');
    const [assetSearch, setAssetSearch] = useState('');
    const [assetBalances, setAssetBalances] = useState<Map<string, string>>(new Map());
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [allChainsConnected, setAllChainsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // ─── Chain type detection ──────────────────────────────────────────────
    const isSourceEvm = selectedChain?.chain_type === 'evm';

    // ─── Data hooks ────────────────────────────────────────────────────────
    const {chains: skipChains, isLoading: isLoadingChains, error: chainsError} = useSkipChains();
    const {assets: skipAssets, isLoading: isLoadingAssets, error: assetsError} = useSkipAssets(selectedChain?.chain_id);
    const {routePreview, rawRoute, isLoading: isLoadingRoute, error: routeError} = useBuyRoute(
        selectedChain?.chain_id, selectedAsset?.denom, selectedAsset?.decimals, amount,
    );

    // ─── Cosmos wallet ─────────────────────────────────────────────────────
    // Chains are dynamically registered with ChainProvider when the user selects
    // them in the Buy BZE picker. Only BZE's IBC counterparties are pre-registered
    // at mount; all other Cosmos chains (e.g. Injective, Stride) get added on demand
    // via walletManager.addChains() when selected. This avoids loading 100+ chains
    // at startup (which causes Keplr errors for broken/unknown chains) while still
    // letting useChain() work for any chain the user actually picks.
    const walletManager = useWalletManager();
    const [registeredChainNames, setRegisteredChainNames] = useState(() =>
        new Set(getWalletChainsNames().map((c: any) => (c.chainName || '').toLowerCase()))
    );

    // Dynamically register a chain with ChainProvider when user selects it
    const ensureChainRegistered = useCallback(async (chainName: string) => {
        if (registeredChainNames.has(chainName.toLowerCase())) return;
        const allChains = getChains() as any[];
        const chain = allChains.find((c: any) => (c.chainName || '').toLowerCase() === chainName.toLowerCase());
        if (!chain) return;
        const allAssetLists = getAssetLists() as any[];
        const assetList = allAssetLists.find((a: any) => (a.chainName || '').toLowerCase() === chainName.toLowerCase());
        try {
            await (walletManager as any).addChains(
                [chain],
                assetList ? [assetList] : [],
                {signing: () => ({preferredSignType: 'amino'})},
            );
            setRegisteredChainNames(prev => new Set([...prev, chainName.toLowerCase()]));
        } catch (e) {
            console.error('[buy] failed to register chain dynamically:', chainName, e);
        }
    }, [walletManager]);

    const sourceChainName = useMemo(() => {
        if (!selectedChain || !selectedChain.canSign || isSourceEvm) return getChainName();
        const registryChain = getChainByChainId(selectedChain.chain_id);
        const name = registryChain?.chainName ?? selectedChain.chain_name ?? '';
        return registeredChainNames.has(name.toLowerCase()) ? name : getChainName();
    }, [selectedChain, isSourceEvm, registeredChainNames]);

    const {address: sourceAddress} = useChain(sourceChainName);
    const bzeChain = useChain(getChainName());

    // ─── EVM wallet ──────────────────────────────────────────────────────
    // Both hooks are safe to call without EvmProvider — they return inert
    // defaults when isAvailable is false.
    const evmState = useEvmWalletState();
    const evmWallet = useEvmWallet();

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

    // ─── Auto-detect existing connections ──────────────────────────────────
    useEffect(() => {
        if (!rawRoute?.required_chain_addresses?.length) return;
        if (allChainsConnected) return;

        // For EVM source: check if EVM wallet is connected
        if (isSourceEvm) {
            if (evmState.isConnected) setAllChainsConnected(true);
            return;
        }

        // For Cosmos source: check Keplr keys
        let cancelled = false;
        (async () => {
            const keplr = (window as any).keplr;
            if (!keplr) return;
            try {
                for (const chainId of rawRoute.required_chain_addresses) {
                    // Skip EVM chain IDs in the required list (intermediate chains
                    // on Cosmos routes are always Cosmos)
                    if (skipChainIdToEvmChainId(chainId) !== undefined) continue;
                    const key = await keplr.getKey(chainId);
                    if (!key?.bech32Address) return;
                }
                if (!cancelled) setAllChainsConnected(true);
            } catch {
                // Not all connected
            }
        })();
        return () => { cancelled = true; };
    }, [rawRoute, allChainsConnected, isSourceEvm, evmState.isConnected]);

    // ─── Connect handler (Cosmos + EVM) ────────────────────────────────────
    const handleConnectAll = useCallback(async () => {
        setIsConnecting(true);
        try {
            if (isSourceEvm) {
                // EVM: connect wallet + switch to the right chain
                if (!evmWallet.isConnected) {
                    await evmWallet.connectInjected();
                }
                const targetEvmChainId = skipChainIdToEvmChainId(selectedChain?.chain_id ?? '');
                if (targetEvmChainId && evmWallet.chainId !== targetEvmChainId) {
                    await evmWallet.switchChain(targetEvmChainId);
                }
            } else {
                // Cosmos: enable all required chains via Keplr
                const keplr = (window as any).keplr;
                if (keplr) {
                    for (const chainId of requiredChainIds) {
                        if (skipChainIdToEvmChainId(chainId) !== undefined) continue;
                        await keplr.enable(chainId);
                    }
                }
            }
            setAllChainsConnected(true);
        } catch (e) {
            console.error('[buy] connect failed:', e);
        } finally {
            setIsConnecting(false);
        }
    }, [isSourceEvm, requiredChainIds, selectedChain, evmWallet, evmState]);

    // ─── Balance fetch (Cosmos only — EVM balance fetch deferred) ──────────
    useEffect(() => {
        if (!allChainsConnected || !selectedChain || isSourceEvm) return;
        if (!sourceAddress) return;

        let cancelled = false;
        setIsLoadingBalances(true);
        (async () => {
            const chainName = getChainByChainId(selectedChain.chain_id)?.chainName ?? selectedChain.chain_name ?? '';
            const restUrl = await getChainRestURL(chainName);
            if (cancelled || !restUrl) { setIsLoadingBalances(false); return; }
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
            } catch { /* non-critical */ }
            finally { if (!cancelled) setIsLoadingBalances(false); }
        })();
        return () => { cancelled = true; };
    }, [allChainsConnected, selectedChain, sourceAddress, isSourceEvm]);

    // ─── Assets with balances ──────────────────────────────────────────────
    const assetsWithBalances = useMemo<SkipAssetWithBalance[]>(() => {
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

        // EVM chain ID → return EVM wallet address
        const evmChainId = skipChainIdToEvmChainId(chainId);
        if (evmChainId !== undefined && evmState.address) {
            return evmState.address;
        }

        // Cosmos: source chain
        if (selectedChain && chainId === selectedChain.chain_id && !isSourceEvm) return sourceAddress;
        const resolved = getChainByChainId(chainId);
        if (resolved?.chainName === getChainName()) return bzeChain.address;

        // Cosmos intermediate chain via Keplr
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
    }, [bzeChain.address, sourceAddress, selectedChain, isSourceEvm, evmState.address]);

    // ─── Execute ───────────────────────────────────────────────────────────
    const canExecute = useMemo(() => {
        return selectedChain?.canSign
            && selectedAsset
            && amount !== ''
            && amountError === ''
            && rawRoute
            && !isExecuting
            && !isLoadingRoute
            && allChainsConnected
            && bzeChain.address;
    }, [selectedChain, selectedAsset, amount, amountError, rawRoute, isExecuting, isLoadingRoute, allChainsConnected, bzeChain.address]);

    const {toast} = useToast();

    const handleExecute = useCallback(async () => {
        if (!rawRoute || !selectedChain || !selectedAsset) return;
        const result = await executeSkipTransfer(rawRoute, getAddressForChainId);
        if (result.success) {
            // Track the transaction for status polling
            addTransaction?.({
                direction: 'deposit',
                sourceChainName: selectedChain.pretty_name || selectedChain.chain_name || selectedChain.chain_id,
                destChainName: 'BeeZee',
                assetTicker: selectedAsset.symbol || '?',
                amountIn: amount,
                estimatedAmountOut: routePreview?.estimatedOutput || '?',
                mechanism: 'skip',
                txHash: result.txHash,
                broadcastChainId: result.chainId,
            });
            toast.success(
                'Swap submitted',
                'Your transaction is being processed. You can track its progress in the wallet view.',
            );
            // Reset form and close the Buy BZE view so the user sees
            // the pending transaction in the balances view.
            setAmount(''); setSelectedAsset(undefined); setSelectedChain(undefined);
            setChainSearch(''); setAssetSearch(''); setAssetBalances(new Map());
            setAllChainsConnected(false);
            onClose?.();
        } else if (result.error) {
            setAmountError(result.error);
        }
    }, [rawRoute, selectedChain, selectedAsset, amount, routePreview, executeSkipTransfer, getAddressForChainId, addTransaction, toast, onClose]);

    // ─── Callbacks ─────────────────────────────────────────────────────────
    const onChainSelect = useCallback(async (chain: SkipChainWithStatus) => {
        if (!chain.canSign) return;
        // For Cosmos chains not yet registered with ChainProvider, register
        // them now so useChain/useSDKTx can work when the user proceeds to sign.
        if (chain.chain_type === 'cosmos') {
            const registryChain = getChainByChainId(chain.chain_id);
            const name = registryChain?.chainName ?? chain.chain_name ?? '';
            if (name) await ensureChainRegistered(name);
        }
        setSelectedChain(chain); setSelectedAsset(undefined);
        setAmount(''); setAmountError(''); setChainSearch(''); setAssetSearch('');
        setAssetBalances(new Map()); setAllChainsConnected(false);
    }, [ensureChainRegistered]);

    const onAssetSelect = useCallback((asset: SkipAsset) => {
        setSelectedAsset(asset); setAmount(''); setAmountError('');
        setAssetSearch(''); setAllChainsConnected(false);
    }, []);

    const onAmountChange = useCallback((value: string) => {
        setAmount(sanitizeNumberInput(value)); setAmountError('');
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
            .map(f => {
                if (f.usdValue) {
                    const usd = parseFloat(f.usdValue);
                    return `$${isNaN(usd) ? f.usdValue : usd.toFixed(2)}`;
                }
                return `${f.amount} ${f.ticker}`;
            })
            .join(' + ');
    }, [routePreview]);

    const needsConnect = rawRoute && requiredChainIds.length > 0 && !allChainsConnected;

    return (
        <VStack gap="4" align="stretch">
            {/* Header */}
            <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="medium">Buy BZE</Text>
                {onClose && (
                    <Button size="xs" variant="ghost" onClick={onClose}><LuX size="14"/></Button>
                )}
            </HStack>

            <Text fontSize="sm" color="fg.muted">Swap assets from other networks to BZE</Text>

            <Box p="2" bg={`${accentColor}.500/10`} borderRadius="md" borderWidth="1px" borderColor={`${accentColor}.500/20`}>
                <Text fontSize="xs" color="fg.muted">
                    Get your BZE! Pick any coin from any supported network and we&apos;ll find the
                    best route to get you BZE in minutes — sometimes even seconds. Not every route
                    is available yet, but feel free to explore and try different options.
                </Text>
            </Box>

            {/* ── Chain picker ──────────────────────────────────────────────── */}
            {chainsError && <Text fontSize="sm" color="red.500">{chainsError}</Text>}

            {!selectedChain && !isLoadingChains && skipChains.length > 0 && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Pay with assets from</Text>
                    <Input size="sm" placeholder="Search network..." value={chainSearch}
                           onChange={(e) => setChainSearch(e.target.value)} mb="2"/>
                    <Box maxH="200px" overflowY="auto" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md">
                        {filteredChains.map(c => (
                            <HStack key={c.chain_id} gap="2" px="3" py="1.5"
                                    cursor={c.canSign ? "pointer" : "not-allowed"}
                                    opacity={c.canSign ? 1 : 0.5}
                                    _hover={c.canSign ? {bg: `${accentColor}.500/10`} : {}}
                                    onClick={() => onChainSelect(c)} justify="space-between">
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
                            <Input size="sm" placeholder="Search asset..." value={assetSearch}
                                   onChange={(e) => setAssetSearch(e.target.value)} mb="2"/>
                            <Box maxH="200px" overflowY="auto" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md">
                                {filteredAssets.map(a => (
                                    <HStack key={a.denom} gap="2" px="3" py="1.5" cursor="pointer"
                                            _hover={{bg: `${accentColor}.500/10`}}
                                            onClick={() => onAssetSelect(a)} justify="space-between">
                                        <HStack gap="2">
                                            <TokenLogo src={a.logo_uri || ''} symbol={a.symbol || '?'} size="16px"/>
                                            <Text fontSize="sm">{a.symbol}</Text>
                                        </HStack>
                                        {a.balanceDisplay ? (
                                            <Text fontSize="xs" fontFamily="mono" color="fg.muted">{a.balanceDisplay}</Text>
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

            {/* ── Amount input ───────────────────────────────────────────────── */}
            {selectedChain && selectedAsset && (
                <Box>
                    <Field.Root invalid={amountError !== ''}>
                        <Field.Label>You pay</Field.Label>
                        <Group attached w="full">
                            <Input size="sm" placeholder="0.00" value={amount}
                                   onChange={(e) => onAmountChange(e.target.value)}/>
                            {assetBalances.get(selectedAsset.denom) && (
                                <Button variant="outline" size="sm" onClick={setMaxAmount}>Max</Button>
                            )}
                        </Group>
                        <Field.ErrorText>{amountError}</Field.ErrorText>
                    </Field.Root>

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

            {/* ── Route preview ──────────────────────────────────────────────── */}
            {routePreview && amount && !isLoadingRoute && (
                <Box p="3" bgGradient="to-br" gradientFrom={`${accentColor}.500/8`} gradientTo={`${accentColor}.600/8`}
                     borderRadius="md" borderWidth="1px" borderColor={`${accentColor}.500/20`}>
                    <VStack gap="2" align="stretch">
                        <HStack justify="space-between">
                            <HStack gap="1">
                                <Text fontSize="sm" color="fg.muted">Estimated output</Text>
                                <Tooltip
                                    showArrow
                                    openDelay={100}
                                    content="This is an estimate based on current prices. The final amount may vary slightly due to price changes during the transfer. A 3% slippage protection is applied — if the price moves beyond that, the transaction will be reverted and your funds returned."
                                    contentProps={{maxW: '250px', fontSize: 'xs'}}
                                >
                                    <Box as="span" cursor="help" color="fg.muted" display="inline-flex" alignItems="center">
                                        <LuInfo size="12"/>
                                    </Box>
                                </Tooltip>
                            </HStack>
                            <Text fontSize="sm" fontWeight="medium" fontFamily="mono">~{shortNumberFormat(toBigNumber(routePreview.estimatedOutput))} BZE</Text>
                        </HStack>
                        <HStack justify="space-between">
                            <Text fontSize="xs" color="fg.muted">Estimated time</Text>
                            <Text fontSize="xs">{formatDuration(routePreview.estimatedDurationSeconds)}</Text>
                        </HStack>
                        {rawRoute && rawRoute.txs_required > 1 && (
                            <HStack justify="space-between">
                                <Text fontSize="xs" color="fg.muted">Steps</Text>
                                <Text fontSize="xs">{rawRoute.txs_required} (approval + bridge)</Text>
                            </HStack>
                        )}
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

            {/* ── Connect wallets ────────────────────────────────────────────── */}
            {needsConnect && (
                <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                    {isSourceEvm ? (
                        <>
                            <Text fontSize="sm" color="fg.muted">
                                Connect your EVM wallet to complete this swap on {sourceDisplayName}.
                            </Text>
                            {evmState.isAvailable && !evmWallet.isConnected && (
                                <HStack gap="2" w="full">
                                    {evmWallet.hasInjected && (
                                        <Button flex="1" size="sm" colorPalette={accentColor}
                                                onClick={async () => { setIsConnecting(true); try { await evmWallet.connectInjected(); setAllChainsConnected(true); } catch {} finally { setIsConnecting(false); } }}
                                                loading={isConnecting}>
                                            MetaMask
                                        </Button>
                                    )}
                                    <Button flex="1" size="sm" variant="outline" colorPalette={accentColor}
                                            onClick={async () => { setIsConnecting(true); try { await evmWallet.connectWalletConnect(); setAllChainsConnected(true); } catch {} finally { setIsConnecting(false); } }}
                                            loading={isConnecting}>
                                        WalletConnect
                                    </Button>
                                </HStack>
                            )}
                            {!evmState.isAvailable && (
                                <Text fontSize="xs" color="orange.500">
                                    EVM wallet support is not configured in this app.
                                </Text>
                            )}
                        </>
                    ) : (
                        <>
                            <Text fontSize="sm" color="fg.muted">
                                To complete this swap, your wallet needs access to{' '}
                                <Text as="span" fontWeight="medium">{requiredChainNames.join(', ')}</Text>.
                                This lets us sign and route the transaction on your behalf.
                            </Text>
                            <Button size="sm" w="full" colorPalette={accentColor}
                                    onClick={handleConnectAll} loading={isConnecting} loadingText="Connecting...">
                                Approve connections
                            </Button>
                        </>
                    )}
                </VStack>
            )}

            {/* ── Buy BZE button ─────────────────────────────────────────────── */}
            {!needsConnect && (
                <Button size="sm" w="full" colorPalette={accentColor}
                        disabled={!canExecute} loading={isExecuting}
                        loadingText={progressMessage || "Swapping..."}
                        onClick={handleExecute}>
                    Buy BZE
                </Button>
            )}
        </VStack>
    );
};
