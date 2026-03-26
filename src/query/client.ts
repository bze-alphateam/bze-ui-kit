import {getSettings} from "../storage/settings";
import {bze} from '@bze/bzejs';
import {PageRequest} from "@bze/bzejs/cosmos/base/query/v1beta1/pagination";

export const getRestClient = () => {
    const settings = getSettings()

    return createRestClient(settings.endpoints.restEndpoint)
}

export const createRestClient = async (endpoint: string): Promise<ReturnType<typeof bze.ClientFactory.createLCDClient>> => {
    return bze.ClientFactory.createLCDClient({restEndpoint: endpoint})
}

export const getPageRequestWithLimit = (limit: number)=> {
    return PageRequest.fromPartial({
        limit: BigInt(limit)
    })
}
