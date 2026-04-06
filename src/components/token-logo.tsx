'use client';

import {Box} from '@chakra-ui/react';
import type {ImageProps} from '@chakra-ui/react';
import {ImageWithFallback} from './image';

interface TokenLogoProps extends Omit<ImageProps, 'src' | 'alt' | 'rounded'> {
    /** Token logo URL — may be empty/undefined; we'll render a sensible fallback. */
    src?: string;
    /** Token symbol, used for alt text and the fallback initial. */
    symbol: string;
    /** Size of the logo (applies to both width and height). Default `8`. */
    size?: string | number;
    /** Custom fallback JSX. If not provided we use `/images/token.svg` → initial letter chain. */
    customFallback?: React.ReactNode;
    /** Whether to render as a circle (default) or a rounded square. */
    circular?: boolean;
}

/**
 * Token logo with graceful degradation.
 *
 * Priority:
 *   1. Render the provided `src`.
 *   2. If the image fails to load, try the default `/images/token.svg`.
 *   3. If that also fails, show a circular tile with the first letter of
 *      `symbol` — guaranteed to always render something.
 *
 * Extracted from dex.getbze.com so every app in the BZE ecosystem (dex,
 * burner, the bridge form in the shared wallet sidebar) can reuse the same
 * visual treatment without duplicating the fallback boilerplate.
 */
export const TokenLogo = ({
                              src,
                              symbol,
                              size = "8",
                              customFallback,
                              circular = true,
                              ...props
                          }: TokenLogoProps) => {
    const fallbackComponent = customFallback || (
        <ImageWithFallback
            src="/images/token.svg"
            alt="Default token"
            w="full"
            h="full"
            objectFit="cover"
            fallback={
                <Box
                    w="full"
                    h="full"
                    bg="bg.surface"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="xs"
                    fontWeight="bold"
                    color="fg.muted"
                    borderRadius={circular ? "full" : "md"}
                >
                    {symbol.charAt(0).toUpperCase()}
                </Box>
            }
        />
    );

    return (
        <Box
            w={size}
            h={size}
            borderRadius={circular ? "full" : "md"}
            overflow="hidden"
            bg="bg.surface"
            flexShrink={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
        >
            {src ? (
                <ImageWithFallback
                    src={src}
                    alt={`${symbol} token logo`}
                    w="full"
                    h="full"
                    objectFit="contain"
                    fallback={fallbackComponent}
                    {...props}
                />
            ) : (
                fallbackComponent
            )}
        </Box>
    );
};
