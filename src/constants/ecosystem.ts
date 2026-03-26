import type { IconType } from 'react-icons';
import { LuGlobe, LuCoins, LuChartColumn, LuFlame, LuFactory } from 'react-icons/lu';

export const ECOSYSTEM_MENU_LABEL = 'Other';

export interface EcosystemApp {
    name: string;
    href: string;
    disabled: boolean;
    icon: IconType;
    /** Unique key used for env var overrides and exclusions (e.g. 'website', 'staking', 'dex') */
    key: string;
}

/**
 * Default ecosystem apps. Each app has a unique `key` used for:
 * - Link overrides: NEXT_PUBLIC_ECOSYSTEM_LINK_{KEY} (e.g. NEXT_PUBLIC_ECOSYSTEM_LINK_WEBSITE=https://testnet.getbze.com)
 * - Label overrides: NEXT_PUBLIC_ECOSYSTEM_LABEL_{KEY} (e.g. NEXT_PUBLIC_ECOSYSTEM_LABEL_DEX=TestDEX)
 * - Exclusions: NEXT_PUBLIC_ECOSYSTEM_EXCLUDED=website,factory (comma-separated keys)
 */
const DEFAULT_APPS: Array<{ key: string; name: string; href: string; disabled: boolean; icon: IconType }> = [
    { key: 'website',  name: 'Website',  href: 'https://getbze.com',          disabled: false, icon: LuGlobe },
    { key: 'staking',  name: 'Staking',  href: 'https://staking.getbze.com',  disabled: false, icon: LuCoins },
    { key: 'dex',      name: 'DEX',      href: 'https://dex.getbze.com',      disabled: false, icon: LuChartColumn },
    { key: 'burner',   name: 'Burner',   href: 'https://burner.getbze.com',   disabled: false, icon: LuFlame },
    { key: 'factory',  name: 'Factory',  href: '#',                            disabled: true,  icon: LuFactory },
];

/**
 * Reads the NEXT_PUBLIC_ECOSYSTEM_EXCLUDED env var and returns a Set of excluded keys.
 */
const getExcludedKeys = (): Set<string> => {
    const raw = process.env.NEXT_PUBLIC_ECOSYSTEM_EXCLUDED || '';
    if (!raw.trim()) {
        return new Set();
    }

    return new Set(raw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean));
};

/**
 * Returns the list of ecosystem apps with env var overrides applied and exclusions removed.
 *
 * Env vars:
 * - NEXT_PUBLIC_ECOSYSTEM_LINK_{KEY}  — override the href for an app (key uppercased, e.g. NEXT_PUBLIC_ECOSYSTEM_LINK_WEBSITE)
 * - NEXT_PUBLIC_ECOSYSTEM_LABEL_{KEY} — override the label for an app (e.g. NEXT_PUBLIC_ECOSYSTEM_LABEL_DEX)
 * - NEXT_PUBLIC_ECOSYSTEM_EXCLUDED    — comma-separated keys to exclude (e.g. "staking,factory")
 */
export const getEcosystemApps = (): EcosystemApp[] => {
    const excluded = getExcludedKeys();

    return DEFAULT_APPS
        .filter(app => !excluded.has(app.key))
        .map(app => {
            const envKey = app.key.toUpperCase();
            const linkOverride = process.env[`NEXT_PUBLIC_ECOSYSTEM_LINK_${envKey}`];
            const labelOverride = process.env[`NEXT_PUBLIC_ECOSYSTEM_LABEL_${envKey}`];

            return {
                key: app.key,
                name: labelOverride || app.name,
                href: linkOverride || app.href,
                disabled: linkOverride ? false : app.disabled,
                icon: app.icon,
            };
        });
};
