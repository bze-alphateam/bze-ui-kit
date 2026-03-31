'use client'
import "@interchain-kit/react/styles.css";
import {InterchainWalletModal, useChain, useWalletManager} from "@interchain-kit/react";
import {
    Badge,
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
    Separator,
    Text,
    Textarea,
    VStack,
} from '@chakra-ui/react'
import {LuCopy, LuExternalLink, LuX} from 'react-icons/lu'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {getChainExplorerURL, getChainName} from "../../constants/chain";
import {WalletState} from "@interchain-kit/core";
import {stringTruncateFromCenter} from "../../utils/strings";
import {useBalances} from "../../hooks/useBalances";
import type {AssetBalance} from "../../hooks/useBalances";
import {isIbcDenom, isLpDenom} from "../../utils/denom";

import {amountToUAmount, prettyAmount, uAmountToAmount, uAmountToBigNumberAmount} from "../../utils/amount";
import {getChainNativeAssetDenom} from "../../constants/assets";
import {sanitizeNumberInput} from "../../utils/number";
import {validateBZEBech32Address} from "../../utils/address";
import BigNumber from "bignumber.js";
import {useToast} from "../../hooks/useToast";
import {useSDKTx} from "../../hooks/useTx";
import {cosmos} from "@bze/bzejs";
import {openExternalLink} from "../../utils/functions";
import {shortNumberFormat} from "../../utils/formatter";
import {HighlightText} from "../highlight";
import {useIsInHub} from "@bze/hub-connector";

type ViewState = 'balances' | 'send'

interface WalletSidebarContentProps {
    accentColor?: string
}

interface BalanceItemProps {
    asset: AssetBalance;
    onClick: () => void;
    accentColor: string;
}

const validateAmount = (amount: string, coin: AssetBalance|undefined, onError:(msg: string) => void) => {
    if (!coin) return
    if (amount === "") return

    const amountNumber = BigNumber(amount)
    if (amountNumber.isNaN()) {
        onError('Invalid amount')
        return
    }

    const coinBalance = uAmountToBigNumberAmount(coin.amount, coin.decimals)
    if (coinBalance.isLessThan(amount)) {
        onError('Insufficient balance')
    } else {
        onError('')
    }
}

const BalanceItem = ({asset, onClick, accentColor}: BalanceItemProps) => {
    const [showSendButton, setShowSendButton] = useState(false)
    const formattedBalanceAmount = useMemo(() => {
        return prettyAmount(uAmountToBigNumberAmount(asset.amount, asset.decimals ?? 0))
    }, [asset.amount, asset.decimals])

    const formattedBalanceUSDValue = useMemo(() => {
        return shortNumberFormat(asset.USDValue)
    }, [asset.USDValue])

    return (
        <Box
            p="3"
            bgGradient="to-br"
            gradientFrom={`${accentColor}.500/5`}
            gradientTo={`${accentColor}.600/5`}
            borderRadius="md"
            borderWidth="1px"
            borderColor={`${accentColor}.500/15`}
            _hover={{
                gradientFrom: `${accentColor}.500/10`,
                gradientTo: `${accentColor}.600/10`,
                borderColor: `${accentColor}.500/25`
            }}
            transition="all 0.2s"
            onMouseLeave={() => setShowSendButton(false)}
            onMouseEnter={() => setShowSendButton(true)}
        >
            <HStack justify="space-between" mb="2">
                <HStack>
                    <Image
                        src={asset.logo}
                        alt={asset.ticker}
                        width="20px"
                        height="20px"
                        borderRadius="full"
                    />
                    <Text fontSize="sm" fontWeight="medium">
                        {asset.ticker}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                        {asset.name}
                    </Text>
                    {isIbcDenom(asset.denom) && (
                        <Badge size="xs" colorPalette={accentColor}>
                            IBC
                        </Badge>
                    )}
                </HStack>
                {showSendButton && (
                    <HStack justify="end">
                        <Button size='2xs' variant={'outline'} onClick={onClick}>Send</Button>
                    </HStack>
                )}
            </HStack>
            <HStack justify="space-between">
                <HighlightText fontSize="sm" fontFamily="mono">
                    {formattedBalanceAmount}
                </HighlightText>
                <HighlightText fontSize="sm" color="fg.muted">
                    ${formattedBalanceUSDValue}
                </HighlightText>
            </HStack>
        </Box>
    )
}

const SendForm = ({balances, onClose, selectedTicker, accentColor}: {balances: AssetBalance[], onClose: () => void, selectedTicker: string, accentColor: string}) => {
    // Send form state
    const [isLoading, setIsLoading] = useState(false)
    const [selectedCoin, setSelectedCoin] = useState<AssetBalance|undefined>()

    const [sendAmount, setSendAmount] = useState('')
    const [sendAmountError, setSendAmountError] = useState('')

    const [recipient, setRecipient] = useState('')
    const [recipientError, setRecipientError] = useState('')

    const [memo, setMemo] = useState('')
    const [memoError, setMemoError] = useState('')

    //other hooks
    const { toast } = useToast()
    const { status, address } = useChain(getChainName());
    const {tx} = useSDKTx(getChainName());

    // Create collections for selects
    const coinsCollection = createListCollection({
        items: balances.map(item => ({
            label: `${item.ticker} - ${shortNumberFormat(uAmountToBigNumberAmount(item.amount, item?.decimals ?? 0))}`,
            value: item.ticker,
            logo: item.logo
        }))
    })

    const isValidForm = useMemo(() => {
        return selectedCoin &&
            memoError === "" &&
            recipientError === "" &&
            sendAmountError === "" &&
            sendAmount !== "" &&
            recipient !== ""
    }, [selectedCoin, memoError, recipientError, sendAmountError, sendAmount, recipient])

    const resetSendForm = useCallback(() => {
        setSelectedCoin(undefined)
        setSendAmount('')
        setRecipient('')
        setMemo('')
    }, [])

    const handleSend = useCallback(async () => {
        if (!isValidForm) {
            toast.error('Can not send coins!', 'Please check the input data.')
            return
        }

        if (status !== WalletState.Connected) {
            toast.error('Wallet not connected!','Please connect your wallet first.')
            return
        }

        const {send} = cosmos.bank.v1beta1.MessageComposer.withTypeUrl;

        const msg = send({
            fromAddress: address,
            toAddress: recipient,
            amount: [{
                denom: selectedCoin?.denom ?? '',
                amount: amountToUAmount(sendAmount, selectedCoin?.decimals ?? 0)
            }],
        })

        setIsLoading(true)
        await tx([msg], {memo: memo.length > 0 ? memo : undefined});

        // Reset form
        resetSendForm()
        setIsLoading(false)
        onClose()
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, memo, onClose, recipient, selectedCoin, sendAmount, status])

    const handleCancel = useCallback(() => {
        resetSendForm()
        onClose()
    }, [onClose, resetSendForm])

    const onRecipientChange = useCallback((recipient: string) => {
        setRecipient(recipient)
        if (recipient.length === 0) {
            setRecipientError('')
            return
        }

        const validate = validateBZEBech32Address(recipient)
        if (validate.isValid) {
            setRecipientError('')
        } else {
            setRecipientError(validate.message)
        }
    }, [])

    const onAmountChange = useCallback((amount: string) => {
        setSendAmount(sanitizeNumberInput(amount))
        setSendAmountError('')
    }, [])

    const onCoinSelectChange = useCallback((ticker: string) => {
        if (ticker === "") return

        const selectedCoin = balances.find(item => item.ticker === ticker)
        if (selectedCoin) {
            setSelectedCoin(selectedCoin)
            validateAmount(sendAmount, selectedCoin, setSendAmountError)
        }
    }, [sendAmount, balances])

    const setMaxAmount = useCallback(() => {
        if (!selectedCoin) return
        const maxAmount = uAmountToBigNumberAmount(selectedCoin.amount, selectedCoin.decimals)
        onAmountChange(maxAmount.toString())
        validateAmount(maxAmount.toString(), selectedCoin, setSendAmountError)
    }, [selectedCoin, onAmountChange])

    const onMemoChange = useCallback((memo: string) => {
        setMemo(memo)
        if (memo.length > 256) {
            setMemoError('Memo must be less than or equal to 256 characters')
        } else {
            setMemoError('')
        }
    }, [])

    useEffect(() => {
        if (selectedTicker !== '') {
            onCoinSelectChange(selectedTicker)
        }
    }, [onCoinSelectChange, selectedTicker])

    return (
        <VStack gap="4" align="stretch">
            <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="medium">
                    Send Coins
                </Text>
                <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isLoading}
                >
                    <LuX size="14" />
                </Button>
            </HStack>

            <Box>
                <Select.Root
                    collection={coinsCollection}
                    size="sm"
                    value={selectedCoin?.ticker ? [selectedCoin.ticker] : []}
                    onValueChange={(details) => onCoinSelectChange(details.value[0] || '')}
                >
                    <Select.Label>Coin</Select.Label>
                    <Select.HiddenSelect />
                    <Select.Control>
                        <Select.Trigger>
                            <Select.ValueText placeholder="Select coin" />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                            <Select.Indicator />
                        </Select.IndicatorGroup>
                    </Select.Control>
                    <Portal>
                        <Select.Positioner>
                            <Select.Content>
                                {coinsCollection.items.map((item) => (
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

                {selectedCoin && (
                    <Box
                        mt="2"
                        p="3"
                        bgGradient="to-br"
                        gradientFrom={`${accentColor}.500/10`}
                        gradientTo={`${accentColor}.600/10`}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor={`${accentColor}.500/30`}
                    >
                        <HStack justify="space-between">
                            <Text fontSize="xs" color="fg.muted">
                                Available:
                            </Text>
                            <VStack gap="0" align="end">
                                <Text fontSize="sm" fontWeight="medium">
                                    {uAmountToAmount(selectedCoin.amount, selectedCoin.decimals)} {selectedCoin.ticker}
                                </Text>
                                {selectedCoin.USDValue.gt(0) && (
                                    <Text fontSize="xs" color="fg.muted">
                                        ≈ ${shortNumberFormat(selectedCoin.USDValue)}
                                    </Text>
                                )}
                            </VStack>
                        </HStack>
                    </Box>
                )}
            </Box>

            <Box>
                <Field.Root invalid={sendAmountError !== ""}>
                    <Field.Label>Amount</Field.Label>
                    <Group attached w="full" maxW="sm">
                        <Input
                            size="sm"
                            placeholder="Amount to send"
                            value={sendAmount}
                            onChange={(e) => onAmountChange(e.target.value)}
                            onBlur={() => validateAmount(sendAmount, selectedCoin, setSendAmountError)}
                        />
                        <Button variant="outline" size="sm" onClick={setMaxAmount} disabled={isLoading}>
                            Max
                        </Button>
                    </Group>
                    <Field.ErrorText>{sendAmountError}</Field.ErrorText>
                </Field.Root>
            </Box>
            <Box>
                <Field.Root invalid={recipientError !== ""}>
                    <Field.Label>Recipient Address</Field.Label>
                    <Input
                        size="sm"
                        placeholder="bze...2a1b"
                        value={recipient}
                        onChange={(e) => onRecipientChange(e.target.value)}
                    />
                    <Field.ErrorText>{recipientError}</Field.ErrorText>
                </Field.Root>
            </Box>

            <Box>
                <Field.Root invalid={memoError !== ""}>
                    <Field.Label>Memo
                        <Field.RequiredIndicator
                            fallback={
                                <Badge size="xs" variant="surface">
                                    Optional
                                </Badge>
                            }
                        />
                    </Field.Label>
                    <Textarea
                        size="sm"
                        placeholder="Transaction memo"
                        rows={3}
                        value={memo}
                        onChange={(e) => onMemoChange(e.target.value)}
                        resize="none"
                    />
                    <Field.ErrorText>{memoError}</Field.ErrorText>
                </Field.Root>
            </Box>

            <HStack gap="2">
                <Button
                    size="sm"
                    flex="1"
                    onClick={handleSend}
                    colorPalette={accentColor}
                    disabled={!isValidForm || isLoading}
                    loading={isLoading}
                    loadingText={"Sending..."}
                >
                    Send
                </Button>
                <Button
                    size="sm"
                    flex="1"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                >
                    Cancel
                </Button>
            </HStack>
        </VStack>
    )
}

export const WalletSidebarContent = ({ accentColor = 'blue' }: WalletSidebarContentProps) => {
    const [viewState, setViewState] = useState<ViewState>('balances')
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [showCopiedTooltip, setShowCopiedTooltip] = useState(false)
    const [clickedBalance, setClickedBalance] = useState('')
    const copyButtonRef = useRef<HTMLButtonElement>(null)
    const inHub = useIsInHub();

    const {
        status,
        username,
        address,
        disconnect,
        connect,
    } = useChain(getChainName());
    const walletManager = useWalletManager();
    const {assetsBalances, isLoading: assetsLoading} = useBalances();

    // In BZE Hub: auto-connect to Keplr (our bridge) without showing the modal
    const handleConnect = useCallback(() => {
        if (inHub) {
            walletManager.connect("keplr-extension", getChainName());
        } else {
            connect();
        }
    }, [connect, walletManager, inHub]);

    const balancesWithoutLps = useMemo(() => {
        if (assetsLoading) return [];

        return assetsBalances.filter(asset => !isLpDenom(asset.denom))
    }, [assetsLoading, assetsBalances])

    const nativeDenom = getChainNativeAssetDenom()
    const sortedBalances = useMemo(() => {
        return balancesWithoutLps.sort((a, b) => {
            // 1. Native denom always first
            if (a.denom === nativeDenom) return -1;
            if (b.denom === nativeDenom) return 1;

            // 2. Verified vs non-verified
            if (a.verified && !b.verified) return -1;
            if (!a.verified && b.verified) return 1;

            // 3. Positive balances vs zero balances
            const aHasBalance = a.amount.gt(0);
            const bHasBalance = b.amount.gt(0);

            if (aHasBalance && !bHasBalance) return -1;
            if (!aHasBalance && bHasBalance) return 1;

            // 4. If both have positive balances, sort by USD amount descending
            if (aHasBalance && bHasBalance) {
                return a.USDValue.gt(b.USDValue) ? -1 : 1;
            }

            // 5. For remaining items (both zero balance), maintain stable sort
            return 0;
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [balancesWithoutLps])

    const walletAddress = useMemo(() => stringTruncateFromCenter(address ?? "", 16), [address])

    const handleCopyAddress = () => {
        navigator.clipboard.writeText(address)
        setShowCopiedTooltip(true)
        setTimeout(() => setShowCopiedTooltip(false), 2000)
    }

    const handleCancel = useCallback(() => {
        setViewState('balances')
        setClickedBalance('')
    }, [])

    const onBalanceClick = useCallback((ticker: string) => {
        setClickedBalance(ticker)
        setViewState('send')
    }, [])

    const handleDisconnectAll = useCallback(async () => {
        setIsDisconnecting(true)
        try {
            console.log('Disconnected from all chains')
        } catch (error) {
            console.error('Error disconnecting:', error)
        } finally {
            disconnect()
            setIsDisconnecting(false)
        }
    }, [disconnect])

    const renderBalancesView = () => (
        <VStack gap="6" align="stretch">
            {/* Token Balances Section */}
            <Box>
                <Text fontSize="sm" fontWeight="medium" mb="3">
                    Balances
                </Text>
                <VStack gap="2" align="stretch">
                    {sortedBalances.map((bal) => (
                        <BalanceItem key={bal.denom} asset={bal} onClick={() => onBalanceClick(bal.ticker)} accentColor={accentColor}/>
                    ))}
                </VStack>
            </Box>

            {/* Quick Actions Section */}
            <Box>
                <Text fontSize="sm" fontWeight="medium" mb="3">
                    Quick Actions
                </Text>
                <VStack gap="2" align="stretch">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewState('send')}
                        w="full"
                        disabled={assetsLoading}
                    >
                        Send
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        w="full"
                        onClick={() => openExternalLink('https://go.skip.build/?src_chain=1&src_asset=ethereum-native&dest_chain=beezee-1&dest_asset=ubze')}
                    >
                        <LuExternalLink />
                        Cross-chain Deposit
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        w="full"
                        onClick={() => openExternalLink(`${getChainExplorerURL(getChainName())}/account/${address}`)}
                    >
                        <LuExternalLink />
                        View on Explorer
                    </Button>
                </VStack>
            </Box>

            {/* Disconnect Button */}
            <Box>
                <Button
                    size="sm"
                    width="full"
                    variant="outline"
                    colorPalette="red"
                    onClick={handleDisconnectAll}
                    loading={isDisconnecting}
                    loadingText={"Disconnecting..."}
                >
                    Disconnect Wallet
                </Button>
            </Box>
        </VStack>
    )

    const statusColor = useMemo(() => {
        switch (status) {
            case WalletState.Connected:
                return 'green'
            case WalletState.Connecting:
                return 'yellow'
            case WalletState.Disconnected:
                return 'red'
            default:
                return 'gray'
        }
    }, [status])

    return (
        <VStack gap="6" align="stretch">
            {/* Wallet Status - Always at top */}
            <Box>
                {!inHub && <InterchainWalletModal />}
                <HStack justify="space-between" mb="3">
                    <Text fontSize="sm" fontWeight="medium">
                        Wallet Status
                    </Text>
                    <Badge colorPalette={statusColor} size="sm">
                        {status}
                    </Badge>
                </HStack>
                {status === WalletState.Connected &&
                    <Box
                        p="3"
                        bgGradient="to-br"
                        gradientFrom={`${accentColor}.500/8`}
                        gradientTo={`${accentColor}.600/8`}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor={`${accentColor}.500/20`}
                    >
                        <Text fontSize="xs" color="fg.muted" mb="1">
                            {username ?? "Address"}
                        </Text>
                        <HStack justify="space-between">
                            <Text fontSize="sm" fontFamily="mono">
                                {walletAddress}
                            </Text>
                            <Box position="relative">
                                <Button
                                    ref={copyButtonRef}
                                    size="xs"
                                    variant="ghost"
                                    onClick={handleCopyAddress}
                                >
                                    <LuCopy />
                                </Button>
                                {showCopiedTooltip && (
                                    <Box
                                        position="absolute"
                                        top="-35px"
                                        right="0"
                                        bgGradient="to-br"
                                        gradientFrom={`${accentColor}.500`}
                                        gradientTo={`${accentColor}.600`}
                                        color="white"
                                        px="3"
                                        py="1.5"
                                        borderRadius="md"
                                        fontSize="xs"
                                        fontWeight="semibold"
                                        whiteSpace="nowrap"
                                        zIndex="tooltip"
                                        shadow="md"
                                    >
                                        Copied!
                                    </Box>
                                )}
                            </Box>
                        </HStack>
                    </Box>
                }
                {status !== WalletState.Connected &&
                    <Button
                        size="sm"
                        variant="solid"
                        w="full"
                        onClick={handleConnect}
                    >
                        {inHub ? "Connect to Hub Wallet" : "Connect Wallet"}
                    </Button>
                }
            </Box>

            <Separator />

            {/* Dynamic Content Based on View State */}
            {status === WalletState.Connected && viewState === 'balances' && renderBalancesView()}
            {status === WalletState.Connected && viewState === 'send' && <SendForm balances={sortedBalances} onClose={handleCancel} selectedTicker={clickedBalance} accentColor={accentColor}/>}
        </VStack>
    )
}
