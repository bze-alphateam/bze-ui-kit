'use client';

import {useState} from "react";
import {getSettings, setSettings} from "../storage/settings";
import {AppSettings} from "../types/settings";

export function useSettings() {
    const [settings, setSettingsState] = useState<AppSettings>(getSettings());

    const saveSettings = (newSettings: AppSettings): boolean => {
        const result = setSettings(newSettings);
        if (result) {
            setSettingsState(newSettings);
        }
        return result;
    }

    return {
        settings,
        saveSettings,
    }
}
