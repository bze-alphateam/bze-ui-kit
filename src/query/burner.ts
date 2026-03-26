import {ParamsSDKType as BurnerParams} from "@bze/bzejs/bze/burner/params";
import {getRestClient} from "./client";
import {QueryAllBurnedCoinsResponseSDKType} from "@bze/bzejs/bze/burner/query";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";
import {bze} from '@bze/bzejs'
import {PageRequest} from "@bze/bzejs/cosmos/base/query/v1beta1/pagination";

const BURNED_KEY = 'burner:all_burned_coins';
const LOCAL_CACHE_TTL = 60 * 60 * 4; //4 hours

const {fromPartial: QueryAllBurnedCoinsRequestFromPartial} = bze.burner.QueryAllBurnedCoinsRequest;

export const getBurnerParams = async (): Promise<BurnerParams|undefined> => {
    try {
        const client = await getRestClient();

        return getBurnerParamsWithClient(client)
    } catch (error) {
        console.error('failed to get burner params: ', error);
    }

    return undefined
}

export const getBurnerParamsWithClient = async (client: Awaited<ReturnType<typeof getRestClient>>): Promise<BurnerParams|undefined>=> {
    try {
        const response = await client.bze.burner.params();

        return response.params;
    } catch (error) {
        console.error('failed to get burner params: ', error);
    }

    return undefined;
}

export async function getAllBurnedCoins(): Promise<QueryAllBurnedCoinsResponseSDKType> {
    try {
        const localData = getFromLocalStorage(BURNED_KEY);
        if (null !== localData) {
            const parsed = JSON.parse(localData);
            if (parsed) {
                return parsed;
            }
        }

        const client = await getRestClient();
        const response = await client.bze.burner.allBurnedCoins(
            QueryAllBurnedCoinsRequestFromPartial({
                pagination: PageRequest.fromPartial({reverse: true})
            })
        );
        setInLocalStorage(BURNED_KEY, JSON.stringify(response), LOCAL_CACHE_TTL);

        return response;
    } catch (e) {
        console.error(e);
        return {
            burnedCoins: [],
        };
    }
}
