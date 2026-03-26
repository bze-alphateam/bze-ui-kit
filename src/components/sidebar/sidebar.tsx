'use client'

import { Icon, IconButton, Portal } from '@chakra-ui/react'
import type { PropsWithChildren } from 'react'
import { LuX } from 'react-icons/lu'
import { useState } from 'react'

interface SidebarProps extends PropsWithChildren {
    trigger: React.ReactNode
    ariaLabel: string
}

export const Sidebar = ({ children, trigger, ariaLabel }: SidebarProps) => {
    const [isOpen, setIsOpen] = useState(false)

    const handleTriggerClick = () => {
        setIsOpen(true)
    }

    const handleClose = () => {
        setIsOpen(false)
    }

    return (
        <>
            {/* Trigger Button */}
            <div onClick={handleTriggerClick} style={{ cursor: 'pointer' }}>
                {trigger}
            </div>

            {/* Sidebar Overlay */}
            {isOpen && (
                <Portal>
                    {/* Backdrop */}
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            zIndex: '3',
                            display: 'block',
                        }}
                        onClick={(e) => {
                            // Only close if clicking the backdrop itself, not child elements
                            if (e.target === e.currentTarget) {
                                handleClose()
                            }
                        }}
                    />

                    {/* Sidebar Content */}
                    <div
                        id="sidebar-content"
                        style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: window.innerWidth < 768 ? '100vw' : '20vw',
                            minWidth: window.innerWidth < 768 ? '100vw' : '300px',
                            maxWidth: window.innerWidth < 768 ? '100vw' : '400px',
                            backgroundColor: 'var(--chakra-colors-bg-panel)',
                            borderLeft: '1px solid var(--chakra-colors-border-subtle)',
                            boxShadow: window.innerWidth >= 768 ? '-4px 0 12px rgba(0, 0, 0, 0.15)' : 'none',
                            zIndex: '99',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                borderBottom: '1px solid var(--chakra-colors-border-subtle)',
                                backgroundColor: 'var(--chakra-colors-bg-panel)',
                                flexShrink: 0,
                            }}
                        >
                            <h3
                                style={{
                                    fontSize: '1.125rem',
                                    fontWeight: '600',
                                    margin: 0,
                                    color: 'var(--chakra-colors-fg)',
                                }}
                            >
                                {ariaLabel}
                            </h3>
                            <IconButton
                                aria-label="Close sidebar"
                                variant="ghost"
                                size="sm"
                                onClick={handleClose}
                            >
                                <Icon size="md">
                                    <LuX />
                                </Icon>
                            </IconButton>
                        </div>

                        {/* Content Area */}
                        <div
                            style={{
                                padding: '1rem',
                                flex: 1,
                                overflowY: 'auto',
                                backgroundColor: 'var(--chakra-colors-bg-panel)',
                                position: 'relative',
                            }}
                        >
                            {children}
                        </div>
                    </div>
                </Portal>
            )}
        </>
    )
}
