import {useAssetsContext} from "./useAssets";

export function useConnectionType() {
    const {connectionType, updateConnectionType} = useAssetsContext()

    return {
        connectionType,
        updateConnectionType,
    }
}
