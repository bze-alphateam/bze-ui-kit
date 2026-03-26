import {
    QueryAllPendingUnlockParticipantsResponseSDKType,
    QueryAllStakingRewardsResponseSDKType, QueryStakingRewardParticipantResponseSDKType,
} from "@bze/bzejs/bze/rewards/query";
import {bze} from '@bze/bzejs';
import {PageRequest} from "@bze/bzejs/cosmos/base/query/v1beta1/pagination";
import {getRestClient} from "./client";
import {
    PendingUnlockParticipantSDKType,
    StakingRewardParticipantSDKType,
} from "@bze/bzejs/bze/rewards/store";
import {AddressRewardsStaking, ExtendedPendingUnlockParticipantSDKType} from "../types/staking";
import BigNumber from "bignumber.js";

const {fromPartial: QueryAllStakingRewardRequestFromPartial} = bze.rewards.QueryAllStakingRewardsRequest;
const {fromPartial: QueryGetStakingRewardParticipantRequestFromPartial} = bze.rewards.QueryStakingRewardParticipantRequest;
const {fromPartial: QueryAllPendingUnlockParticipantRequestFromPartial} = bze.rewards.QueryAllPendingUnlockParticipantsRequest;

export async function getStakingRewards(reverse: boolean = true): Promise<QueryAllStakingRewardsResponseSDKType> {
    try {
        const client = await getRestClient();
        return await client.bze.rewards.allStakingRewards(QueryAllStakingRewardRequestFromPartial({
            pagination: PageRequest.fromPartial({
                reverse: reverse,
                limit: BigInt(1000)
            })
        }));
    } catch (e) {
        console.error(e);
        return {list: []};
    }
}

export async function getAddressPendingUnlock(address: string): Promise<PendingUnlockParticipantSDKType[]> {
    const all = await getPendingUnlockParticipants();
    if (!all || all.list.length === 0) {
        return [];
    }

    return all.list.filter((item) => item.address === address);
}

export async function getPendingUnlockParticipants(): Promise<QueryAllPendingUnlockParticipantsResponseSDKType> {
    try {
        const client = await getRestClient();
        return client.bze.rewards.allPendingUnlockParticipants(QueryAllPendingUnlockParticipantRequestFromPartial({
            pagination: PageRequest.fromPartial({limit: BigInt(1000)})
        }));
    } catch (e) {
        console.error(e);
        return {list: []};
    }
}

export async function getStakingRewardParticipantByAddress(address: string): Promise<QueryStakingRewardParticipantResponseSDKType> {
    try {
        const client = await getRestClient();
        return client.bze.rewards.stakingRewardParticipant(QueryGetStakingRewardParticipantRequestFromPartial({
            address: address,
            pagination: PageRequest.fromPartial({limit: BigInt(500)})
        }));
    } catch (e) {
        console.error(e);
        return {list: []};
    }
}

export async function getAddressStakingRewards(address: string): Promise<AddressRewardsStaking> {
    const result = {
        address: address,
        active: new Map<string, StakingRewardParticipantSDKType>(),
        unlocking: new Map<string, ExtendedPendingUnlockParticipantSDKType[]>(),
    }

    if (address === "") {
        return result
    }

    try {
        const [participantRewards, pending] = await Promise.all([getStakingRewardParticipantByAddress(address), getAddressPendingUnlock(address)]);
        [result.active, result.unlocking] = await Promise.all([mapParticipantRewards(participantRewards.list), mapPendingUnlock(pending)])

        return result;
    } catch (e) {
        console.error(e);
        return result;
    }
}

async function mapParticipantRewards(participantRewards: StakingRewardParticipantSDKType[]): Promise<Map<string, StakingRewardParticipantSDKType>> {
    const result = new Map<string, StakingRewardParticipantSDKType>();
    for (let i = 0; i < participantRewards.length; i++) {
        result.set(participantRewards[i].reward_id, participantRewards[i]);
    }
    return result;
}

async function mapPendingUnlock(pending: PendingUnlockParticipantSDKType[]): Promise<Map<string, ExtendedPendingUnlockParticipantSDKType[]>> {
    const result = new Map<string, ExtendedPendingUnlockParticipantSDKType[]>
    for (let i = 0; i < pending.length; i++) {
        const splitIndex = pending[i].index.split('/');
        if (splitIndex.length !== 3) {
            console.error("invalid pending unlock index", pending[i].index);
            continue;
        }

        const item = {
            ...pending[i],
            rewardId: splitIndex[1],
            unlockEpoch: new BigNumber(splitIndex[0]),
        }

        const allItems = result.get(item.rewardId) ?? [];
        allItems.push(item);
        result.set(item.rewardId, allItems);
    }
    return result;
}
