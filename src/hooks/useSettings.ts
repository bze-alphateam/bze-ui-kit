'use client';

import { useContext } from 'react'
import { SettingsContext } from '../contexts/settings_context'

// useSettings now reads from the shared SettingsContext.
// SettingsProvider must be mounted above any component that calls this hook.
export function useSettings() {
    const context = useContext(SettingsContext)
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}
