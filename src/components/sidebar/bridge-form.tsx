'use client'

import {useState} from 'react';
import {Button, HStack, Text, VStack} from '@chakra-ui/react';
import {LuX, LuExternalLink} from 'react-icons/lu';
import type {TransferDirection} from '../../types/cross_chain';
import {DepositForm} from './deposit-form';
import {WithdrawForm} from './withdraw-form';
import {openExternalLink} from '../../utils/functions';

const SKIP_GO_URL = 'https://go.skip.build/?dest_chain=beezee-1&dest_asset=ubze';

interface BridgeFormProps {
    accentColor: string;
    onClose?: () => void;
}

/**
 * Top-level bridge form. Renders a direction toggle and delegates to the
 * deposit or withdraw sub-form. Each sub-form is self-contained: its own
 * hooks, pickers, balance logic, wallet connect, and execute button.
 */
export const BridgeForm = ({accentColor, onClose}: BridgeFormProps) => {
    const [direction, setDirection] = useState<TransferDirection>('deposit');

    return (
        <VStack gap="4" align="stretch">
            {/* Header */}
            <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="medium">
                    Deposit / Withdraw
                </Text>
                {onClose && (
                    <Button size="xs" variant="ghost" onClick={onClose}>
                        <LuX size="14"/>
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

            {/* Sub-form — each direction is self-contained */}
            {direction === 'deposit' && <DepositForm accentColor={accentColor}/>}
            {direction === 'withdraw' && <WithdrawForm accentColor={accentColor}/>}

            {/* External Skip.go bridge — for routes outside our IBC counterparties */}
            <Button
                size="sm"
                variant="outline"
                colorPalette={accentColor}
                onClick={() => openExternalLink(SKIP_GO_URL)}
            >
                <HStack gap="1.5">
                    <Text fontSize="sm">Use Skip.go</Text>
                    <LuExternalLink size="12"/>
                </HStack>
            </Button>
        </VStack>
    );
};
