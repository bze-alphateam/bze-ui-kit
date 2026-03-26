import {GetBlockByHeightResponseSDKType} from "@bze/bzejs/cosmos/base/tendermint/v1beta1/query";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";
import {getRestClient} from "./client";
import BigNumber from "bignumber.js";
import {BlockResults} from "../types/block";
import {getSettings} from "../storage/settings";

type FailoverBlockTimes = {
    [key: string]: string;
};

const FAILOVER_BLOCKTIMES: FailoverBlockTimes = {
    "9334084": "2023-12-07T14:30:55.034845214Z",
    "4423602": "2023-01-18T07:51:31.391193017Z",
    "4827583": "2023-02-14T03:34:27.791387761Z",
    "5149043": "2023-03-07T11:41:10.455072975Z",
    "10855457": "2024-03-17T19:41:34.031980836Z",
};

const BLOCK_KEY = 'tendermint:block:';

export async function getBlockDetailsByHeight(height: BigNumber): Promise<GetBlockByHeightResponseSDKType> {
    try {
        const cacheKey = `${BLOCK_KEY}${height}`;
        const localData = getFromLocalStorage(cacheKey);
        if (null !== localData) {
            const parsed = JSON.parse(localData);
            if (parsed) {
                return parsed;
            }
        }

        const client = await getRestClient();
        const response = await client.cosmos.base.tendermint.v1beta1.getBlockByHeight({height: BigInt(height.toFixed(0))});

        setInLocalStorage(cacheKey, JSON.stringify(response), 0);

        return response;
    } catch (e) {
        console.error(e);
        return {};
    }
}

export async function getBlockTimeByHeight(height: BigNumber): Promise<Date | undefined> {
    const details = await getBlockDetailsByHeight(height);
    if (details.block_id === undefined) {
        if (height.toFixed(0) in FAILOVER_BLOCKTIMES) {
            return new Date(FAILOVER_BLOCKTIMES[height.toFixed(0)]);
        }
    }

    return details.block?.header?.time
}

export async function getBlockResults(height: number): Promise<BlockResults | undefined> {
    const settings = getSettings();
    const rpcUrl = settings.endpoints.rpcEndpoint.replace("wss", "https");
    const url = `${rpcUrl}/block_results?height=${height}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.log('not ok response from RPC: ', response);
            return undefined
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to fetch block results:", error);
        throw error;
    }
}
