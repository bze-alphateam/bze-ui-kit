'use client'

import {useState} from 'react';
import {
    Badge,
    Box,
    Button,
    Collapsible,
    HStack,
    Text,
    VStack,
} from '@chakra-ui/react';
import {LuChevronDown, LuCopy, LuExternalLink, LuX} from 'react-icons/lu';
import type {CrossChainTxRecord, SkipTransferEvent} from '../../types/cross_chain';
import {openExternalLink} from '../../utils/functions';
import {txStateLabel, txStateColor, isPendingState} from '../../utils/tx_state';

interface TxDetailsModalProps {
    tx: CrossChainTxRecord;
    onClose: () => void;
    accentColor: string;
}

const hopStateLabel = (state: string): string => {
    switch (state) {
        case 'TRANSFER_UNKNOWN': return 'Waiting';
        case 'TRANSFER_PENDING': return 'Pending';
        case 'TRANSFER_RECEIVED': return 'Received';
        case 'TRANSFER_SUCCESS': return 'Success';
        case 'TRANSFER_FAILURE': return 'Failed';
        default: return state.replace('TRANSFER_', '').toLowerCase();
    }
};

const hopStateColor = (state: string): string => {
    switch (state) {
        case 'TRANSFER_SUCCESS': case 'TRANSFER_RECEIVED': return 'green';
        case 'TRANSFER_FAILURE': return 'red';
        case 'TRANSFER_PENDING': return 'blue';
        default: return 'gray';
    }
};

const formatTime = (timestamp: number): string => {
    const d = new Date(timestamp);
    return d.toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

const truncateHash = (hash: string, chars = 8): string => {
    if (hash.length <= chars * 2 + 3) return hash;
    return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
};

/** Copy text to clipboard and show brief feedback. */
const CopyableHash = ({hash, label}: { hash: string; label?: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(hash);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* fallback: ignore */ }
    };

    return (
        <HStack gap="1">
            {label && <Text fontSize="xs" color="fg.muted">{label}</Text>}
            <Text fontSize="xs" fontFamily="mono" truncate maxW="120px">{truncateHash(hash)}</Text>
            <Button size="xs" variant="ghost" minW="auto" px="0.5" onClick={handleCopy}>
                {copied ? <Text fontSize="xs" color="green.500">✓</Text> : <LuCopy size="10"/>}
            </Button>
        </HStack>
    );
};

/** Explorer link button */
const ExplorerLink = ({link}: { link?: string }) => {
    if (!link) return null;
    return (
        <Button size="xs" variant="ghost" minW="auto" px="0.5" onClick={() => openExternalLink(link)}>
            <LuExternalLink size="10"/>
        </Button>
    );
};

/** A single IBC/bridge hop with its tx hashes. */
const HopDetail = ({event}: { event: SkipTransferEvent }) => {
    const ibc = event.ibc_transfer;
    if (!ibc) return null;

    const txEntries = [
        {label: 'Send', tx: ibc.packet_txs?.send_tx},
        {label: 'Receive', tx: ibc.packet_txs?.receive_tx},
        {label: 'Ack', tx: ibc.packet_txs?.acknowledge_tx},
    ].filter(e => e.tx?.tx_hash);

    return (
        <Box px="3" py="2" borderWidth="1px" borderColor="border.subtle" borderRadius="md">
            <VStack gap="1.5" align="stretch">
                <HStack justify="space-between">
                    <Text fontSize="xs" fontWeight="medium">
                        {ibc.src_chain_id} → {ibc.dst_chain_id}
                    </Text>
                    <Badge size="xs" variant="subtle" colorPalette={hopStateColor(ibc.state)}>
                        {hopStateLabel(ibc.state)}
                    </Badge>
                </HStack>
                {txEntries.map(({label, tx}) => (
                    <HStack key={label} justify="space-between" pl="2">
                        <CopyableHash hash={tx!.tx_hash} label={label}/>
                        <ExplorerLink link={tx!.explorer_link}/>
                    </HStack>
                ))}
            </VStack>
        </Box>
    );
};

/**
 * Transaction details view. Replaces the sidebar content when a user clicks
 * on a pending transaction in "Recent Buys". Shows overall status, amounts,
 * error info, and collapsible per-hop details with copyable tx hashes and
 * explorer links.
 */
export const TxDetailsModal = ({tx, onClose, accentColor}: TxDetailsModalProps) => {
    const transfers = tx.lastStatus?.transfers ?? [];
    const allHops = transfers.flatMap(t => t.transfer_sequence ?? []);
    const hasHops = allHops.length > 0;
    const isPending = isPendingState(tx.state);

    return (
        <VStack gap="4" align="stretch">
            {/* Header */}
            <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="medium">Transaction Details</Text>
                <Button size="xs" variant="ghost" onClick={onClose}>
                    <LuX size="14"/>
                </Button>
            </HStack>

            {/* Summary */}
            <Box
                p="3"
                bg={`${accentColor}.500/5`}
                borderRadius="md"
                borderWidth="1px"
                borderColor={`${accentColor}.500/20`}
            >
                <VStack gap="2" align="stretch">
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="fg.muted">Status</Text>
                        <Badge
                            size="sm" variant="subtle"
                            colorPalette={txStateColor(tx.state)}
                            {...(isPending ? {animation: 'pulse'} : {})}
                        >
                            {txStateLabel(tx.state)}
                        </Badge>
                    </HStack>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="fg.muted">You sent</Text>
                        <Text fontSize="xs" fontFamily="mono">{tx.amountIn} {tx.assetTicker}</Text>
                    </HStack>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="fg.muted">Estimated output</Text>
                        <Text fontSize="xs" fontFamily="mono">~{tx.estimatedAmountOut} BZE</Text>
                    </HStack>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="fg.muted">Route</Text>
                        <Text fontSize="xs">{tx.sourceChainName} → {tx.destChainName}</Text>
                    </HStack>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="fg.muted">Submitted</Text>
                        <Text fontSize="xs">{formatTime(tx.timestamp)}</Text>
                    </HStack>
                </VStack>
            </Box>

            {/* Error */}
            {tx.error && (
                <Box p="3" bg="red.500/10" borderRadius="md" borderWidth="1px" borderColor="red.500/20">
                    <Text fontSize="xs" color="red.600">{tx.error}</Text>
                </Box>
            )}

            {/* Transfer details — collapsible, includes broadcast tx + hops */}
            <Collapsible.Root defaultOpen={isPending}>
                <Collapsible.Trigger asChild>
                    <Button size="sm" variant="ghost" w="full" justifyContent="space-between">
                        <Text fontSize="xs" fontWeight="medium">Transfer details</Text>
                        <LuChevronDown size="14"/>
                    </Button>
                </Collapsible.Trigger>
                <Collapsible.Content>
                    <VStack gap="2" align="stretch" pt="2">
                        {/* Broadcast tx hash */}
                        {tx.txHash && (
                            <Box px="3" py="2" borderWidth="1px" borderColor="border.subtle" borderRadius="md">
                                <HStack justify="space-between">
                                    <Text fontSize="xs" color="fg.muted">Broadcast tx</Text>
                                    <HStack gap="1">
                                        <CopyableHash hash={tx.txHash}/>
                                        {tx.explorerLink && (
                                            <Button size="xs" variant="ghost" minW="auto" px="0.5"
                                                    onClick={() => openExternalLink(tx.explorerLink!)}>
                                                <LuExternalLink size="10"/>
                                            </Button>
                                        )}
                                    </HStack>
                                </HStack>
                            </Box>
                        )}

                        {/* Per-hop details */}
                        {allHops.map((hop, i) => (
                            <HopDetail key={i} event={hop}/>
                        ))}

                        {/* Pending indicator when hops haven't loaded yet */}
                        {isPending && !hasHops && (
                            <HStack gap="2" px="3" py="2" justify="center">
                                <Box h="2" w="2" borderRadius="full" bg={`${accentColor}.500`} animation="pulse"/>
                                <Text fontSize="xs" color="fg.muted">
                                    Waiting for relay details...
                                </Text>
                            </HStack>
                        )}

                        {/* Pending indicator when hops exist but tx not done */}
                        {isPending && hasHops && (
                            <HStack gap="2" px="3" py="1" justify="center">
                                <Box h="2" w="2" borderRadius="full" bg={`${accentColor}.500`} animation="pulse"/>
                                <Text fontSize="xs" color="fg.muted">
                                    Processing...
                                </Text>
                            </HStack>
                        )}
                    </VStack>
                </Collapsible.Content>
            </Collapsible.Root>

            {/* Asset release info */}
            {tx.lastStatus?.transfer_asset_release && (
                <Box p="2" bg={tx.lastStatus.transfer_asset_release.released ? 'green.500/10' : 'orange.500/10'}
                     borderRadius="md">
                    <Text fontSize="xs">
                        {tx.lastStatus.transfer_asset_release.released
                            ? 'Funds have been released to your wallet.'
                            : 'Funds are pending release...'}
                    </Text>
                </Box>
            )}

            <VStack gap="2" w="full">
                {tx.explorerLink && (
                    <Button size="sm" variant="outline" w="full"
                            onClick={() => openExternalLink(tx.explorerLink!)}>
                        <HStack gap="1">
                            <Text>View on Explorer</Text>
                            <LuExternalLink size="12"/>
                        </HStack>
                    </Button>
                )}
                <Button size="sm" variant="outline" w="full" onClick={onClose}>
                    Close
                </Button>
            </VStack>
        </VStack>
    );
};
