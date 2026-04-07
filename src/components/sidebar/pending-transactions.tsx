'use client'

import {Badge, Box, Button, HStack, Text, VStack} from '@chakra-ui/react';
import {LuInfo, LuX} from 'react-icons/lu';
import type {CrossChainTxRecord} from '../../types/cross_chain';
import {txStateLabel, txStateColor, isPendingState} from '../../utils/tx_state';
import {Tooltip} from '../tooltip';

interface PendingTransactionsProps {
    transactions: CrossChainTxRecord[];
    onDismiss: (id: string) => void;
    onSelect: (tx: CrossChainTxRecord) => void;
    accentColor: string;
}

/**
 * Compact list of tracked Skip transactions. Rendered above the balance list
 * in the wallet sidebar. Clicking a row opens a detailed modal with per-hop
 * status and explorer links. Shows nothing when there are no transactions.
 */
export const PendingTransactions = ({transactions, onDismiss, onSelect, accentColor}: PendingTransactionsProps) => {
    if (transactions.length === 0) return null;

    return (
        <VStack gap="2" w="full" align="stretch">
            <HStack gap="1">
                <Text fontSize="xs" fontWeight="medium" color="fg.muted">Recent Buys</Text>
                <Tooltip
                    showArrow
                    openDelay={100}
                    content="Your recent Buy BZE transactions are shown here for up to 1 hour. You can dismiss them anytime or they will disappear automatically."
                    contentProps={{maxW: '220px', fontSize: 'xs'}}
                >
                    <Box as="span" cursor="help" color="fg.muted" display="inline-flex" alignItems="center">
                        <LuInfo size="10"/>
                    </Box>
                </Tooltip>
            </HStack>
            {transactions.map(tx => (
                <HStack
                    key={tx.id}
                    gap="2"
                    px="3"
                    py="2"
                    borderWidth="1px"
                    borderColor={`${accentColor}.500/20`}
                    borderRadius="md"
                    bg={isPendingState(tx.state) ? `${accentColor}.500/5` : undefined}
                    justify="space-between"
                    align="center"
                    cursor="pointer"
                    _hover={{bg: `${accentColor}.500/10`}}
                    onClick={() => onSelect(tx)}
                >
                    <VStack gap="0" align="start" flex="1" minW="0">
                        <Text fontSize="xs" fontWeight="medium" truncate>
                            {tx.amountIn} {tx.assetTicker} → ~{tx.estimatedAmountOut} BZE
                        </Text>
                        <HStack gap="1.5">
                            <Badge
                                size="xs"
                                variant="subtle"
                                colorPalette={txStateColor(tx.state)}
                                {...(isPendingState(tx.state) ? {animation: 'pulse'} : {})}
                            >
                                {txStateLabel(tx.state)}
                            </Badge>
                            <Text fontSize="xs" color="fg.muted">
                                {tx.sourceChainName} → {tx.destChainName}
                            </Text>
                        </HStack>
                    </VStack>
                    <Button
                        size="xs"
                        variant="ghost"
                        minW="auto"
                        px="1"
                        onClick={(e) => {
                            e.stopPropagation(); // Don't open modal
                            onDismiss(tx.id);
                        }}
                    >
                        <LuX size="12"/>
                    </Button>
                </HStack>
            ))}
        </VStack>
    );
};
