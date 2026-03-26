import {DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY} from "../constants/settings";
import {AppSettings} from "../types/settings";
import {getFromLocalStorage, setInLocalStorage, TTL_NO_EXPIRY} from "./storage";

export const getSettings = (): AppSettings => {
    const saved = getFromLocalStorage(SETTINGS_STORAGE_KEY)
    if (saved) {
        const parsed = JSON.parse(saved)
        return { ...DEFAULT_SETTINGS, ...parsed }
    }

    return DEFAULT_SETTINGS;
}

export const setSettings = (newSettings: AppSettings): boolean => {
    return setInLocalStorage(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings), TTL_NO_EXPIRY)
}
