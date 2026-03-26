import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";
import {getRestURL} from "../constants/endpoints";

const MODULE_ADDRESS_KEY = 'auth:module:address:';
const MODULE_ADDRESS_CACHE_TTL = 60 * 60 * 48; //48 hours

function getHardcodedBurnerAddress(): string {
    return 'bze1v7uw4xhrcv0vk7qp8jf9lu3hm5d8uu5yjp5qun';
}

function getHardcodedRaffleAddress(): string {
    return 'bze18hsqalgwlzqavrrkfnxmrjmygwyjy8senx5tgs';
}

export function getHardcodedLockAddress(): string {
    return 'bze1pc5zjcvhx3e8l305zjl72grytfa30r5mdypmw4';
}

export function getBurnerModuleAddress(): string {
    return getHardcodedBurnerAddress();
}

export function getRaffleModuleAddress(): string {
    return getHardcodedRaffleAddress()
}

export async function getModuleAddress(module: string): Promise<string> {
    try {
        const cacheKey = `${MODULE_ADDRESS_KEY}${module}`;
        const localData = getFromLocalStorage(cacheKey);
        if (null !== localData) {
            return localData;
        }

        const url = getRestURL();
        const response = await fetch(`${url}/cosmos/auth/v1beta1/module_accounts/${module}`)
        if (!response.ok) {
            return '';
        }

        const parsed = await response.json()
        const addy = parsed.account.base_account?.address;
        if (addy === undefined) {
            return "";
        }

        setInLocalStorage(cacheKey, addy, MODULE_ADDRESS_CACHE_TTL);

        return addy;
    } catch (e) {
        console.error(e);

        return '';
    }
}
