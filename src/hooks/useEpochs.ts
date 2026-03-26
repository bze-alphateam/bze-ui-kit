import {useMemo} from "react";
import {useAssetsContext} from "./useAssets";

const EPOCH_HOUR = "hour";
const EPOCH_DAY = "day";
const EPOCH_WEEK = "week";

export function useEpochs() {
    const {epochs, isLoading, updateEpochs} = useAssetsContext()

    const hourEpochInfo = useMemo(() => {
        return epochs.get(EPOCH_HOUR)
    }, [epochs])

    const dayEpochInfo = useMemo(() => {
        return epochs.get(EPOCH_DAY)
    }, [epochs])

    const weekEpochInfo = useMemo(() => {
        return epochs.get(EPOCH_WEEK)
    }, [epochs])

    return {
        epochs,
        hourEpochInfo,
        dayEpochInfo,
        weekEpochInfo,
        isLoading,
        updateEpochs,
    }
}
