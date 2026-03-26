import {useCallback, useMemo} from "react";
import {useAssetsContext} from "./useAssets";
import {EpochInfoSDKType} from "@bze/bzejs/bze/epochs/epoch";
import BigNumber from "bignumber.js";

const EPOCH_HOUR = "hour";
const EPOCH_DAY = "day";
const EPOCH_WEEK = "week";

function getEpochDurationByIdentifier(identifier: string): number {
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

export function useEpochs() {
    const {epochs, isLoading, updateEpochs} = useAssetsContext()

    const getCurrentEpoch = useCallback((identifier: string): EpochInfoSDKType | undefined => {
        return epochs.get(identifier);
    }, [epochs]);

    const hourEpochInfo = useMemo((): EpochInfoSDKType | undefined => {
        return epochs.get(EPOCH_HOUR);
    }, [epochs])

    const dayEpochInfo = useMemo((): EpochInfoSDKType | undefined => {
        return epochs.get(EPOCH_DAY);
    }, [epochs])

    const weekEpochInfo = useMemo((): EpochInfoSDKType | undefined => {
        return epochs.get(EPOCH_WEEK);
    }, [epochs])

    const getHourEpochInfo = useCallback((): EpochInfoSDKType | undefined => {
        return epochs.get(EPOCH_HOUR);
    }, [epochs]);

    const getDayEpochInfo = useCallback((): EpochInfoSDKType | undefined => {
        return epochs.get(EPOCH_DAY);
    }, [epochs]);

    const getWeekEpochInfo = useCallback((): EpochInfoSDKType | undefined => {
        return epochs.get(EPOCH_WEEK);
    }, [epochs]);

    const getPeriodicEpochEndTime = useCallback((identifier: string, modWeek: number = 1): Date | undefined => {
        const epoch = epochs.get(identifier);
        if (!epoch || !epoch.current_epoch_start_time) {
            return undefined;
        }
        const current = new BigNumber(epoch.current_epoch);
        let remainingEpochs = modWeek - (current.toNumber() % modWeek);
        if (remainingEpochs === modWeek) {
            remainingEpochs = 0;
        }

        const startAt = new Date(epoch.current_epoch_start_time);
        const duration = getEpochDurationByIdentifier(identifier);
        startAt.setTime(startAt.getTime() + duration + (duration * remainingEpochs));

        return startAt;
    }, [epochs]);

    const getCurrentWeekEpochEndTime = useCallback((): Date | undefined => {
        return getPeriodicEpochEndTime(EPOCH_WEEK);
    }, [getPeriodicEpochEndTime]);

    const getPeriodicWeekEpochEndTime = useCallback((modWeek: number = 1): Date | undefined => {
        return getPeriodicEpochEndTime(EPOCH_WEEK, modWeek);
    }, [getPeriodicEpochEndTime]);

    const epochsList = useMemo(() => Array.from(epochs.values()), [epochs]);

    return {
        epochs: epochsList,
        epochsMap: epochs,
        hourEpochInfo,
        dayEpochInfo,
        weekEpochInfo,
        isLoading,
        updateEpochs,
        getCurrentEpoch,
        getHourEpochInfo,
        getDayEpochInfo,
        getWeekEpochInfo,
        getCurrentWeekEpochEndTime,
        getPeriodicWeekEpochEndTime,
        getPeriodicEpochEndTime,
    }
}

export function useEpochsManager() {
    const { updateEpochs, isLoading } = useAssetsContext();
    return {
        updateEpochs,
        isLoading,
    };
}
