'use client'

import { Text, TextProps } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'

interface HighlightTextProps extends TextProps {
    /**
     * Duration of the highlight effect in milliseconds
     * @default 1000
     */
    duration?: number

    /**
     * Whether to highlight the text on initial mount
     * @default false
     */
    highlightOnMount?: boolean

    /**
     * Color to use for the highlight effect
     * @default 'blue.500'
     */
    highlightColor?: string

    /**
     * Intensity of the highlight effect
     * - 'subtle': Lower opacity highlight (15%)
     * - 'evident': Higher opacity highlight (30%)
     * @default 'subtle'
     */
    highlightIntensity?: 'subtle' | 'evident'

    /**
     * The text content to display and monitor for changes
     */
    children: React.ReactNode
}

export const HighlightText = ({
    duration = 200,
    highlightOnMount = false,
    highlightColor = 'blue.500',
    highlightIntensity = 'subtle',
    children,
    ...textProps
}: HighlightTextProps) => {
    const [isHighlighted, setIsHighlighted] = useState(false)
    const isMountedRef = useRef(false)
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

    // Convert children to a string for comparison
    const childrenString = String(children)
    const previousValueRef = useRef<string>(childrenString)

    // Get opacity and shadow based on intensity
    const highlightOpacity = highlightIntensity === 'subtle' ? '15' : '50'
    const boxShadowStrength = highlightIntensity === 'subtle' ? '10' : '25'

    useEffect(() => {
        // Check if this is the first mount
        if (!isMountedRef.current) {
            isMountedRef.current = true

            // Highlight on mount if requested
            if (highlightOnMount) {
                setIsHighlighted(true)
                timeoutRef.current = setTimeout(() => {
                    setIsHighlighted(false)
                }, duration)
            }

            previousValueRef.current = childrenString
            return
        }

        // Check if the actual value changed (not just reference)
        if (previousValueRef.current !== childrenString) {
            // Clear any existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }

            // Trigger highlight
            setIsHighlighted(true)

            // Remove highlight after duration
            timeoutRef.current = setTimeout(() => {
                setIsHighlighted(false)
            }, duration)

            // Update previous value
            previousValueRef.current = childrenString
        }

        // Cleanup timeout on unmount
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [childrenString, duration, highlightOnMount])

    return (
        <Text
            {...textProps}
            transition={`all ${duration}ms ease-out`}
            bg={isHighlighted ? `${highlightColor}/${highlightOpacity}` : 'transparent'}
            boxShadow={isHighlighted ? `0 0 0 ${highlightIntensity === 'evident' ? '4px' : '3px'} ${highlightColor}/${boxShadowStrength}` : 'none'}
            borderRadius="md"
            px={isHighlighted ? '2' : '0'}
            transform={isHighlighted && highlightIntensity === 'evident' ? 'scale(1.02)' : 'scale(1)'}
            fontWeight={isHighlighted && highlightIntensity === 'evident' ? 'semibold' : textProps.fontWeight}
        >
            {children}
        </Text>
    )
}
