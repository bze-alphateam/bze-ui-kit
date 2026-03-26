import type { IconType } from 'react-icons';
import { LuGlobe, LuCoins, LuChartColumn, LuFlame, LuFactory } from 'react-icons/lu';

export const ECOSYSTEM_MENU_LABEL = 'Other';

export interface EcosystemApp {
    name: string;
    href: string;
    disabled: boolean;
    icon: IconType;
}

const ALL_APPS: EcosystemApp[] = [
    { name: 'Website',  href: 'https://getbze.com',          disabled: false, icon: LuGlobe },
    { name: 'Staking',  href: 'https://staking.getbze.com',  disabled: false, icon: LuCoins },
    { name: 'DEX',      href: 'https://dex.getbze.com',      disabled: false, icon: LuChartColumn },
    { name: 'Burner',   href: 'https://burner.getbze.com',   disabled: false, icon: LuFlame },
    { name: 'Factory',  href: '#',                            disabled: true,  icon: LuFactory },
];

/**
 * Returns the list of ecosystem apps excluding the current app.
 * Uses NEXT_PUBLIC_SITE_URL to determine which app we're running in.
 */
export const getEcosystemApps = (): EcosystemApp[] => {
    const currentHost = process.env.NEXT_PUBLIC_SITE_URL || '';
    if (!currentHost) {
        return ALL_APPS;
    }

    return ALL_APPS.filter(app => app.href !== currentHost);
}
