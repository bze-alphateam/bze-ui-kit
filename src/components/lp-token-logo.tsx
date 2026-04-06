'use client';

import {Box} from "@chakra-ui/react";
import type {BoxProps} from "@chakra-ui/react";
import {TokenLogo} from "./token-logo";

export interface LPTokenLogoProps extends Omit<BoxProps, 'size'> {
    baseAssetLogo: string;
    quoteAssetLogo: string;
    baseAssetSymbol: string;
    quoteAssetSymbol: string;
    size?: string;
}

/**
 * Overlapping pair of token logos used for liquidity pool display. The base
 * asset sits on the left; the quote asset overlaps slightly to the right.
 *
 * Extracted from dex.getbze.com + burner.getbze.com so both apps (and any
 * future pool UIs) share the same visual treatment.
 */
export const LPTokenLogo = ({
                                baseAssetLogo,
                                quoteAssetLogo,
                                baseAssetSymbol,
                                quoteAssetSymbol,
                                size = "8",
                                ...props
                            }: LPTokenLogoProps) => {
    return (
        <Box position="relative" display="inline-flex" alignItems="center" {...props}>
            <Box
                position="relative"
                zIndex={0}
                borderRadius="full"
                bg="bg.canvas"
            >
                <TokenLogo
                    src={baseAssetLogo}
                    symbol={baseAssetSymbol}
                    size={size}
                    circular={true}
                />
            </Box>
            <Box
                position="relative"
                zIndex={1}
                ml="-3"
                borderRadius="full"
                bg="bg.canvas"
            >
                <TokenLogo
                    src={quoteAssetLogo}
                    symbol={quoteAssetSymbol}
                    size={size}
                    circular={true}
                />
            </Box>
        </Box>
    );
};
