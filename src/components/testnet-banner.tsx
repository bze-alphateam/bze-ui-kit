'use client'

import { Box, Text } from "@chakra-ui/react"
import { isTestnetChain } from "../constants/chain"

export const TestnetBanner = () => {
    if (!isTestnetChain()) {
        return null
    }

    return (
        <Box
            position="fixed"
            bottom="0"
            left="0"
            right="0"
            bg="red.600"
            color="white"
            textAlign="center"
            py="1"
            zIndex="banner"
            fontSize="xs"
            fontWeight="bold"
            letterSpacing="wide"
        >
            <Text>YOU ARE ON TESTNET</Text>
        </Box>
    )
}
