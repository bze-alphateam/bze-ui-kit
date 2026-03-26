import {QueryEpochsInfoResponseSDKType} from "@bze/bzejs/bze/epochs/query";
import {getRestClient} from "./client";
import {EpochInfoSDKType} from "@bze/bzejs/bze/epochs/epoch";
import {toBigNumber} from "../utils/amount";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";

const EPOCH_HOUR = "hour";
const EPOCH_DAY = "day";
const EPOCH_WEEK = "week";
const EPOCHS_INFO_CACHE_KEY = "epochs:info";
const EPOCHS_INFO_CACHE_TTL = 60 * 60;

export async function getEpochsInfo(): Promise<QueryEpochsInfoResponseSDKType> {
    try {
        const cachedData = getFromLocalStorage(EPOCHS_INFO_CACHE_KEY);
        let shouldFetchFromEndpoint = false;

        if (cachedData !== null) {
            const cached: QueryEpochsInfoResponseSDKType = JSON.parse(cachedData);

            const now = new Date().getTime();
            for (const epoch of cached.epochs) {
                if (epoch.current_epoch_start_time) {
                    const startTime = new Date(epoch.current_epoch_start_time).getTime();
                    const duration = getEpochDurationByIdentifier(epoch.identifier);
                    const epochEndTime = startTime + duration - (15 * 1000);

                    if (now >= epochEndTime) {
                        shouldFetchFromEndpoint = true;
                        break;
                    }
                }
            }

            if (!shouldFetchFromEndpoint) {
                return cached;
            }
        }

        const client = await getRestClient();
        const response = await client.bze.epochs.epochInfos();
        setInLocalStorage(EPOCHS_INFO_CACHE_KEY, JSON.stringify(response), EPOCHS_INFO_CACHE_TTL);

        return response;
    } catch (e) {
        console.error(e);

        return {epochs: []};
    }
}

export async function getCurrentEpoch(identifier: string): Promise<EpochInfoSDKType|undefined> {
    const all = await getEpochsInfo();

    return all.epochs.find((item: EpochInfoSDKType) => item.identifier === identifier);
}

export async function getHourEpochInfo() {
    return getCurrentEpoch(EPOCH_HOUR);
}

export async function getWeekEpochInfo() {
    return getCurrentEpoch(EPOCH_WEEK);
}

export async function getCurrentWeekEpochEndTime(): Promise<Date|undefined> {
    return getPeriodicEpochEndTime(EPOCH_WEEK);
}

export async function getPeriodicWeekEpochEndTime(modWeek: number = 1): Promise<Date|undefined> {
    return getPeriodicEpochEndTime(EPOCH_WEEK, modWeek);
}

export async function getPeriodicEpochEndTime(identifier: string, mod: number = 1): Promise<Date|undefined> {
    const epoch = await getCurrentEpoch(identifier);
    if (!epoch || !epoch.current_epoch_start_time) {
        return undefined;
    }
    const current = toBigNumber(epoch.current_epoch);
    let remainingEpochs = mod - (current.toNumber() % mod);
    if (remainingEpochs === mod) {
        remainingEpochs = 0;
    }

    const startAt = (new Date(epoch.current_epoch_start_time));
    const duration = getEpochDurationByIdentifier(identifier);
    startAt.setTime(startAt.getTime() + duration + (duration * remainingEpochs));

    return startAt;
}

export function getEpochDurationByIdentifier(identifier: string): number {
    const hourMs = 60 * 60 * 1000;
    switch (identifier) {
        case EPOCH_HOUR:
            return hourMs;
        case EPOCH_DAY:
            return hourMs * 24;
        case EPOCH_WEEK:
            return hourMs * 24 * 7;
        default:
            return hourMs;
    }
}
