'use client'

import {
    VStack,
    HStack,
    Text,
    Switch,
    Button,
    Separator,
    Box,
    Input,
    Badge,
    createListCollection,
} from '@chakra-ui/react'
import { Select, Portal } from '@chakra-ui/react'
import { useTheme } from "next-themes"
import {useState, useEffect, useMemo, useCallback} from 'react'
import { useSettings } from '../../hooks/useSettings'
import {convertToWebSocketUrl, validateEndpoints} from '../../utils/validation'
import {
    CONNECTION_TYPE_NONE,
    CONNECTION_TYPE_POLLING,
    CONNECTION_TYPE_WS,
} from '../../types/settings'
import type { EndpointValidationResults } from '../../types/settings'
import {useToast} from "../../hooks/useToast"
import {useConnectionType} from "../../hooks/useConnectionType"
import {useFeeTokens} from "../../hooks/useFeeTokens"
import {getChainNativeAssetDenom} from "../../constants/assets"
import {useIsInHub} from "@bze/hub-connector"
import {LuInfo} from "react-icons/lu"

interface SettingsSidebarContentProps {
    accentColor?: string
}

export const SettingsSidebarContent = ({ accentColor = 'blue' }: SettingsSidebarContentProps) => {
    const inHub = useIsInHub()
    const { setTheme, resolvedTheme} = useTheme()
    const {toast} = useToast()
    const { settings, isLoaded, updateEndpoints, updatePreferredFeeDenom, defaultSettings } = useSettings()
    const {connectionType} = useConnectionType()
    const { feeTokens, isLoading: feeTokensLoading } = useFeeTokens()

    // Local form state
    const [restEndpoint, setRestEndpoint] = useState('')
    const [rpcEndpoint, setRpcEndpoint] = useState('')
    const [isValidating, setIsValidating] = useState(false)
    const [validationResults, setValidationResults] = useState<EndpointValidationResults>({})
    const [preferredFeeDenom, setPreferredFeeDenom] = useState<string | undefined>(undefined)

    // Initialize form with loaded settings
    useEffect(() => {
        if (isLoaded) {
            setRestEndpoint(settings.endpoints.restEndpoint)
            setRpcEndpoint(settings.endpoints.rpcEndpoint)
            setPreferredFeeDenom(settings.preferredFeeDenom || getChainNativeAssetDenom())
        }
    }, [isLoaded, settings])

    const handleValidateEndpoints = useCallback(async (rest: string, rpc: string) => {
        setIsValidating(true)
        setValidationResults({})

        try {
            const results = await validateEndpoints(rest, rpc)
            setValidationResults({
                rest: results.rest,
                rpc: results.rpc
            })
        } catch (error) {
            console.error(error)
            setValidationResults({
                rest: { isValid: false, error: 'Validation failed' },
                rpc: { isValid: false, error: 'Validation failed' }
            })
        } finally {
            setIsValidating(false)
            setTimeout(() => setValidationResults({}), 10_000)
        }
    }, [])

    const handleSaveSettings = useCallback(async (rest: string, rpc: string, feeDenom?: string) => {
        setValidationResults({})
        const results = await validateEndpoints(rest, rpc)
        if (!results.isValid) {
            setValidationResults({
                rest: results.rest,
                rpc: results.rpc
            })

            setTimeout(() => setValidationResults({}), 10_000)

            return
        }

        const endpointsSuccess = updateEndpoints({
            restEndpoint: rest.trim(),
            rpcEndpoint: convertToWebSocketUrl(rpc.trim())
        })

        const feeTokenSuccess = updatePreferredFeeDenom(feeDenom)

        if (endpointsSuccess && feeTokenSuccess) {
            toast.success('Success!', 'Settings have been saved.')
        }
    }, [updateEndpoints, updatePreferredFeeDenom, toast])

    const handleResetToDefaults = useCallback(() => {
        setRestEndpoint(defaultSettings.endpoints.restEndpoint)
        setRpcEndpoint(defaultSettings.endpoints.rpcEndpoint)
        setPreferredFeeDenom(defaultSettings.preferredFeeDenom)
        setValidationResults({})
    }, [defaultSettings])

    const connectionStatusText = useMemo(() => {
        switch(connectionType) {
            case CONNECTION_TYPE_NONE:
                return 'Failed'
            case CONNECTION_TYPE_POLLING:
                return 'Polling'
            case CONNECTION_TYPE_WS:
                return 'Connected'
        }
    }, [connectionType])

    const connectionStatusBadgeColor = useMemo(() => {
        switch(connectionType) {
            case CONNECTION_TYPE_NONE:
                return 'red'
            case CONNECTION_TYPE_POLLING:
                return 'orange'
            case CONNECTION_TYPE_WS:
                return 'green'
        }
    }, [connectionType])

    // Create fee tokens collection for select
    const feeTokensCollection = useMemo(() => createListCollection({
        items: feeTokens.map(token => ({
            label: token.ticker || token.name,
            value: token.denom,
            name: token.ticker || token.name,
        }))
    }), [feeTokens])

    const handleFeeTokenChange = useCallback((denom: string) => {
        setPreferredFeeDenom(denom || undefined)
    }, [])

    const hasUnsavedChanges =
        restEndpoint !== settings.endpoints.restEndpoint ||
        rpcEndpoint !== settings.endpoints.rpcEndpoint ||
        preferredFeeDenom !== settings.preferredFeeDenom

    return (
        <VStack gap="6" align="stretch">
            {/* Hub info banner */}
            {inHub && (
                <Box
                    p="3"
                    bg="blue.50"
                    _dark={{ bg: "blue.950/40" }}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={{ base: "blue.200", _dark: "blue.800" }}
                >
                    <HStack gap="2" align="start">
                        <Box mt="0.5">
                            <LuInfo size={16} color="var(--chakra-colors-blue-500)" />
                        </Box>
                        <Text fontSize="xs" color="blue.700" _dark={{ color: "blue.300" }}>
                            Appearance and endpoint settings are managed by BZE Hub. Use the Hub app to change theme or network configuration.
                        </Text>
                    </HStack>
                </Box>
            )}

            {/* Appearance Section */}
            <Box>
                <Text fontSize="sm" fontWeight="medium" mb="3">
                    Appearance
                </Text>
                <VStack gap="3" align="stretch">
                    <HStack justify="space-between">
                        <Text fontSize="sm" color={inHub ? "fg.muted" : undefined}>Dark Mode</Text>
                        <Switch.Root
                            checked={resolvedTheme === 'dark'}
                            onCheckedChange={(details) => {
                                const newTheme = details.checked ? 'dark' : 'light'
                                setTheme(newTheme)
                            }}
                            disabled={inHub}
                        >
                            <Switch.HiddenInput />
                            <Switch.Control>
                                <Switch.Thumb />
                            </Switch.Control>
                        </Switch.Root>
                    </HStack>
                </VStack>
            </Box>

            <Separator />

            {/* Fee Token Preference Section */}
            <Box>
                <Text fontSize="sm" fontWeight="medium" mb="3">
                    Fee Token Preference
                </Text>
                <VStack gap="3" align="stretch">
                    <Box>
                        <Select.Root
                            collection={feeTokensCollection}
                            size="sm"
                            value={preferredFeeDenom ? [preferredFeeDenom] : ['']}
                            onValueChange={(details) => handleFeeTokenChange(details.value[0] || '')}
                            disabled={feeTokensLoading}
                        >
                            <Select.Label>Preferred Fee Token</Select.Label>
                            <Select.HiddenSelect />
                            <Select.Control>
                                <Select.Trigger>
                                    <Select.ValueText placeholder="Native Token (default)" />
                                </Select.Trigger>
                                <Select.IndicatorGroup>
                                    <Select.Indicator />
                                </Select.IndicatorGroup>
                            </Select.Control>
                            <Portal>
                                <Select.Positioner>
                                    <Select.Content>
                                        {feeTokensCollection.items.map((item) => (
                                            <Select.Item key={item.value} item={item}>
                                                <Text>{item.label}</Text>
                                                <Select.ItemIndicator />
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Positioner>
                            </Portal>
                        </Select.Root>
                        <Text fontSize="xs" color="fg.muted" mt="2">
                            Select your preferred token for paying transaction fees. Only tokens with liquidity pools paired with the native token are available.
                        </Text>
                    </Box>
                </VStack>
            </Box>

            <Separator />

            {/* BeeZee Endpoints Section */}
            <Box>
                <Text fontSize="sm" fontWeight="medium" mb="3">
                    BeeZee Endpoints
                </Text>

                <VStack gap="4" align="stretch">
                    <Box>
                        <HStack gap="2" align="center" justify="space-between">
                            <Text fontSize="sm" mb="1">Status: </Text>
                            <Badge colorPalette={connectionStatusBadgeColor}>{connectionStatusText}</Badge>
                        </HStack>
                    </Box>
                    {/* REST Endpoint */}
                    <Box>
                        <Text fontSize="sm" mb="1">REST Endpoint</Text>
                        <Text fontSize="xs" color="fg.muted" mb="2">
                            Note: Endpoint must have CORS enabled to work in browser
                        </Text>
                        <Input
                            size="sm"
                            placeholder="https://rest.getbze.com"
                            value={restEndpoint}
                            onChange={(e) => setRestEndpoint(e.target.value)}
                            disabled={inHub}
                        />
                        {validationResults.rest && (
                            <Box
                                mt="2"
                                p="3"
                                bgGradient="to-br"
                                gradientFrom={validationResults.rest.isValid ? "green.500/15" : "red.500/15"}
                                gradientTo={validationResults.rest.isValid ? "green.600/15" : "red.600/15"}
                                borderWidth="1px"
                                borderColor={validationResults.rest.isValid ? "green.500/30" : "red.500/30"}
                                borderRadius="md"
                            >
                                <Text fontSize="sm" color={validationResults.rest.isValid ? "green.700" : "red.700"} _dark={{color: validationResults.rest.isValid ? "green.300" : "red.300"}}>
                                    {validationResults.rest.error || 'REST endpoint is valid'}
                                </Text>
                            </Box>
                        )}
                    </Box>

                    {/* RPC Endpoint */}
                    <Box>
                        <Text fontSize="sm" mb="1">RPC Endpoint</Text>
                        <Text fontSize="xs" color="fg.muted" mb="2">
                            Note: Must support WebSocket (WS/WSS) connections
                        </Text>
                        <Input
                            size="sm"
                            placeholder="wss://rpc.getbze.com"
                            value={rpcEndpoint}
                            onChange={(e) => setRpcEndpoint(e.target.value)}
                            disabled={inHub}
                        />
                        {validationResults.rpc && (
                            <Box
                                mt="2"
                                p="3"
                                bgGradient="to-br"
                                gradientFrom={validationResults.rpc.isValid ? "green.500/15" : "red.500/15"}
                                gradientTo={validationResults.rpc.isValid ? "green.600/15" : "red.600/15"}
                                borderWidth="1px"
                                borderColor={validationResults.rpc.isValid ? "green.500/30" : "red.500/30"}
                                borderRadius="md"
                            >
                                <Text fontSize="sm" color={validationResults.rpc.isValid ? "green.700" : "red.700"} _dark={{color: validationResults.rpc.isValid ? "green.300" : "red.300"}}>
                                    {validationResults.rpc.error || 'RPC endpoint is valid'}
                                </Text>
                            </Box>
                        )}
                    </Box>

                    {/* Validation Button */}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleValidateEndpoints(restEndpoint, rpcEndpoint)}
                        loading={isValidating}
                        disabled={inHub || !restEndpoint.trim() || !rpcEndpoint.trim()}
                    >
                        {isValidating ? 'Validating...' : 'Validate Endpoints'}
                    </Button>
                </VStack>
            </Box>

            {/* Action Buttons */}
            <Box>
                <VStack gap="3">
                    <Button
                        size="sm"
                        width="full"
                        onClick={() => handleSaveSettings(restEndpoint, rpcEndpoint, preferredFeeDenom)}
                        colorPalette={accentColor}
                        disabled={inHub || !hasUnsavedChanges}
                    >
                        Save Settings
                    </Button>
                    <Button
                        size="sm"
                        width="full"
                        variant="outline"
                        onClick={handleResetToDefaults}
                        disabled={inHub}
                    >
                        Reset to Defaults
                    </Button>
                </VStack>
            </Box>
        </VStack>
    )
}
