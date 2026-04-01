'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SettingsContext, SettingsContextType } from '../contexts/settings_context';
import { AppSettings, BeeZeeEndpoints } from '../types/settings';
import { DEFAULT_SETTINGS } from '../constants/settings';
import { getSettings, setSettings } from '../storage/settings';
import { getChainNativeAssetDenom } from '../constants/assets';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setSettingsState(getSettings());
        setIsLoaded(true);
    }, []);

    const saveSettings = useCallback((newSettings: AppSettings): boolean => {
        setSettings(newSettings);
        setSettingsState(newSettings);
        return true;
    }, []);

    const updateEndpoints = useCallback((endpoints: BeeZeeEndpoints): boolean => {
        setSettingsState(prev => {
            const newSettings = { ...prev, endpoints };
            setSettings(newSettings);
            return newSettings;
        });
        return true;
    }, []);

    const updatePreferredFeeDenom = useCallback((preferredFeeDenom?: string): boolean => {
        setSettingsState(prev => {
            const newSettings = { ...prev, preferredFeeDenom };
            setSettings(newSettings);
            return newSettings;
        });
        return true;
    }, []);

    const resetToDefaults = useCallback((): boolean => {
        setSettings(DEFAULT_SETTINGS);
        setSettingsState(DEFAULT_SETTINGS);
        return true;
    }, []);

    const getEndpoints = useCallback((): BeeZeeEndpoints => {
        return settings.endpoints;
    }, [settings.endpoints]);

    const defaultSettings = useMemo(() => DEFAULT_SETTINGS, []);

    const feeDenom = useMemo(
        () => settings.preferredFeeDenom || getChainNativeAssetDenom(),
        [settings.preferredFeeDenom]
    );

    const value = useMemo<SettingsContextType>(() => ({
        settings,
        isLoaded,
        feeDenom,
        saveSettings,
        updateEndpoints,
        updatePreferredFeeDenom,
        resetToDefaults,
        getEndpoints,
        defaultSettings,
    }), [settings, isLoaded, feeDenom, saveSettings, updateEndpoints, updatePreferredFeeDenom, resetToDefaults, getEndpoints, defaultSettings]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}
