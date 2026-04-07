'use client'

import {Tooltip as ChakraTooltip, Portal} from '@chakra-ui/react';
import {forwardRef, type ReactNode, type RefObject} from 'react';

export interface TooltipProps extends ChakraTooltip.RootProps {
    showArrow?: boolean;
    portalled?: boolean;
    portalRef?: RefObject<HTMLElement>;
    content: ReactNode;
    contentProps?: ChakraTooltip.ContentProps;
    disabled?: boolean;
}

/**
 * Chakra UI v3 Tooltip wrapper. The multi-part Tooltip API
 * (Root/Trigger/Positioner/Content/Arrow) is collapsed into a single
 * component with a `content` prop for convenience.
 *
 * Ported from the dex's `components/ui/tooltip.tsx` so the shared lib
 * can use tooltips without depending on app-specific components.
 */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
    function Tooltip(props, ref) {
        const {
            showArrow,
            children,
            disabled,
            portalled = true,
            content,
            contentProps,
            portalRef,
            ...rest
        } = props;

        if (disabled) return children;

        return (
            <ChakraTooltip.Root {...rest}>
                <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
                <Portal disabled={!portalled} container={portalRef}>
                    <ChakraTooltip.Positioner>
                        <ChakraTooltip.Content ref={ref} {...contentProps}>
                            {showArrow && (
                                <ChakraTooltip.Arrow>
                                    <ChakraTooltip.ArrowTip/>
                                </ChakraTooltip.Arrow>
                            )}
                            {content}
                        </ChakraTooltip.Content>
                    </ChakraTooltip.Positioner>
                </Portal>
            </ChakraTooltip.Root>
        );
    },
);
