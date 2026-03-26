import {getRestClient} from "./client";
import {PageRequest} from "@bze/bzejs/cosmos/base/query/v1beta1/pagination";
import BigNumber from "bignumber.js";
import {Balance} from "../types/balance";
import {getChainNativeAssetDenom} from "../constants/assets";
import {UnbondingDelegationSDKType} from "@bze/bzejs/cosmos/staking/v1beta1/staking";
import {NativeUnbondingSummary, UserNativeStakingRewards} from "../types/staking";

export const getAddressDelegations = async (address: string) => {
    try {
        const client = await getRestClient();
        const response = await client.cosmos.staking.v1beta1.delegatorDelegations({
            delegatorAddr: address,
            pagination: PageRequest.fromPartial({
                limit: BigInt(1000)
            })});

        return response.delegation_responses;
    } catch (e) {
        console.error("failed to get address delegations",e);
        return [];
    }
}

export const getAddressNativeDelegatedBalance = async (address: string): Promise<Balance> => {
    const delegations = await getAddressDelegations(address);
    const total = delegations.reduce((acc, delegation) => {
        if (!delegation.balance) return acc;
        if (delegation.balance.denom !== getChainNativeAssetDenom()) return acc;
        return acc.plus(delegation.balance.amount);
    }, new BigNumber(0));

    return {
        denom: getChainNativeAssetDenom(),
        amount: total
    }
}

export const getAddressUnbondingDelegations = async (address: string): Promise<UnbondingDelegationSDKType[]> => {
    try {
        const client = await getRestClient();
        const resp = await client.cosmos.staking.v1beta1.delegatorUnbondingDelegations({
            delegatorAddr: address,
            pagination: PageRequest.fromPartial({
                limit: BigInt(1000)
            })
        });

        return resp.unbonding_responses;
    } catch (e) {
        console.error("failed to get address delegations",e);
        return [];
    }
}

export const getAddressUnbondingDelegationsSummary = async (address: string): Promise<NativeUnbondingSummary> => {
    const unbondingDelegations = await getAddressUnbondingDelegations(address);
    let totalAmount = new BigNumber(0);
    let firstUnlockDate: Date|undefined = undefined;
    let firstUnlock: Balance|undefined = undefined;
    unbondingDelegations.map(delegation => {
        delegation.entries.forEach(entry => {
            totalAmount = totalAmount.plus(entry.balance);
            const entryDate = new Date(entry.completion_time);
            if (!firstUnlockDate || entryDate < firstUnlockDate) {
                firstUnlockDate = entryDate;
                firstUnlock = {
                    amount: new BigNumber(entry.balance),
                    denom: getChainNativeAssetDenom()
                }
            }
        })
    })

    return {
        total: {
            amount: totalAmount,
            denom: getChainNativeAssetDenom()
        },
        firstUnlock: {
            amount: firstUnlock,
            unlockTime: firstUnlockDate
        }
    }
}

export const getAddressRewards = async (address: string) => {
    try {
        const client = await getRestClient();
        return await client.cosmos.distribution.v1beta1.delegationTotalRewards({delegatorAddress: address})
    } catch (e) {
        console.error("failed to get address rewards", e);
        return {
            rewards: [],
            total: []
        }
    }
}

export const getAddressNativeTotalRewards = async (address: string): Promise<UserNativeStakingRewards> => {
    const rewards = await getAddressRewards(address);
    const total = rewards.total.find(r => r.denom === getChainNativeAssetDenom());
    if (!total) {
        return {
            total: {
                denom: getChainNativeAssetDenom(),
                amount: new BigNumber(0)
            },
            validators: []
        }
    }

    const validators: string[] = [];
    rewards.rewards.map((r) => {
        const rewards = new BigNumber(r.reward.find(r => r.denom === getChainNativeAssetDenom())?.amount ?? "0").integerValue()
        if (!rewards.gt(0)) {
            return
        }
        validators.push(r.validator_address);
    });

    return {
        total: {
            denom: getChainNativeAssetDenom(),
            amount: new BigNumber(total.amount).integerValue(),
        },
        validators: validators,
    }
}

export const getAnnualProvisions = async () => {
    try {
        const client = await getRestClient();
        const resp = await client.cosmos.mint.v1beta1.annualProvisions()
        return new BigNumber(resp.annual_provisions as unknown as string).integerValue()
    } catch (e) {
        console.error("failed to get annual provisions", e);
        return new BigNumber(0);
    }
}

export const getDistributionParams = async () => {
    try {
        const client = await getRestClient();
        const resp = await client.cosmos.distribution.v1beta1.params()
        return resp.params;
    } catch (e) {
        console.error("failed to get distribution params", e);
        return {
            community_tax: "0.05",
            base_proposer_reward: "0.1",
            bonus_proposer_reward: "0.2",
            withdraw_addr_enabled: true,
        }
    }
}

export const getStakingParams = async () => {
    try {
        const client = await getRestClient();
        const resp = await client.cosmos.staking.v1beta1.params()
        return resp.params;
    } catch (e) {
        console.error("failed to get distribution params", e);
        return {
            unbonding_time: "1814400s",
            max_validators: 100,
            max_entries: 7,
            historical_entries: 0,
            bond_denom: "ubze",
        }
    }
}

export const getStakingPool = async () => {
    try {
        const client = await getRestClient();
        const resp = await client.cosmos.staking.v1beta1.pool()
        return resp.pool
    } catch (e) {
        console.error("failed to get staking pool", e);
        return {
            not_bonded_tokens: "0",
            bonded_tokens: "0",
        }
    }
}
