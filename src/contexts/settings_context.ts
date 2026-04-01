'use client';

import { createContext } from 'react';
import { AppSettings, BeeZeeEndpoints } from '../types/settings';

export interface SettingsContextType {
    settings: AppSettings;
    isLoaded: boolean;
    feeDenom: string;
    saveSettings: (newSettings: AppSettings) => boolean;
    updateEndpoints: (endpoints: BeeZeeEndpoints) => boolean;
    updatePreferredFeeDenom: (preferredFeeDenom?: string) => boolean;
    resetToDefaults: () => boolean;
    getEndpoints: () => BeeZeeEndpoints;
    defaultSettings: AppSettings;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
