'use client';

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AppSettings, BeeZeeEndpoints } from '../types/settings'
import { DEFAULT_SETTINGS } from '../constants/settings'
import {getSettings, setSettings} from "../storage/settings";
import {getChainNativeAssetDenom} from "../constants/assets";

// Custom hook for managing application settings
export function useSettings() {
    const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS)
    const [isLoaded, setIsLoaded] = useState(false)

    // Load settings from localStorage on mount
    useEffect(() => {
        setSettingsState(getSettings())
        setIsLoaded(true)
    }, [])

    // Save settings to localStorage
    const saveSettings = useCallback((newSettings: AppSettings): boolean => {
        setSettings(newSettings)
        setSettingsState(newSettings)
        return true
    }, [])

    // Update endpoint configuration
    const updateEndpoints = useCallback((endpoints: BeeZeeEndpoints): boolean => {
        const newSettings = { ...settings, endpoints }
        return saveSettings(newSettings)
    }, [settings, saveSettings])

    // Update preferred fee denom
    const updatePreferredFeeDenom = useCallback((preferredFeeDenom?: string): boolean => {
        const newSettings = { ...settings, preferredFeeDenom }
        return saveSettings(newSettings)
    }, [settings, saveSettings])

    // Reset all settings to default values
    const resetToDefaults = useCallback((): boolean => {
        saveSettings(DEFAULT_SETTINGS)
        return true
    }, [saveSettings])

    // Get current endpoint configuration
    const getEndpoints = useCallback((): BeeZeeEndpoints => {
        return settings.endpoints
    }, [settings.endpoints])

    const defaultSettings = useMemo(() => DEFAULT_SETTINGS, [])

    const feeDenom = useMemo(() => settings.preferredFeeDenom || getChainNativeAssetDenom(), [settings.preferredFeeDenom])

    return {
        settings,
        isLoaded,
        saveSettings,
        updateEndpoints,
        updatePreferredFeeDenom,
        resetToDefaults,
        getEndpoints,
        defaultSettings,
        feeDenom,
    }
}
