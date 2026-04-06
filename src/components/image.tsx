'use client';

import {Box, Image} from '@chakra-ui/react';
import {useEffect, useState} from 'react';
import type {ImageProps} from '@chakra-ui/react';

interface ImageWithFallbackProps extends Omit<ImageProps, 'onError'> {
    fallback?: React.ReactNode;
    fallbackText?: string;
}

/**
 * `<Image>` wrapper that renders a fallback when:
 *   • no `src` is provided, or
 *   • the browser fails to load the image (onError fires).
 *
 * Avoids the React warning about passing an empty string to the `src`
 * attribute on a raw `<img>`.
 */
export const ImageWithFallback = ({
                                      src,
                                      alt,
                                      fallback,
                                      fallbackText,
                                      ...props
                                  }: ImageWithFallbackProps) => {
    const [hasError, setHasError] = useState(false);

    // Reset the error flag when the src prop changes — otherwise a previously
    // broken image would keep showing the fallback even after the caller
    // swapped in a valid URL.
    useEffect(() => {
        setHasError(false);
    }, [src]);

    const handleError = () => setHasError(true);

    const shouldShowFallback = hasError || !src;

    if (shouldShowFallback) {
        return fallback || (
            <Box
                w="full"
                h="full"
                bg="bg.surface"
                borderColor="border.subtle"
                borderWidth="1px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="xs"
                fontWeight="bold"
                color="fg.muted"
                {...props}
            >
                {fallbackText || (alt ? alt.charAt(0).toUpperCase() : '?')}
            </Box>
        );
    }

    return (
        <Image
            src={src}
            alt={alt}
            onError={handleError}
            {...props}
        />
    );
};
