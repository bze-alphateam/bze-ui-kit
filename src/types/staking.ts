import {Balance} from "./balance";
import {PendingUnlockParticipantSDKType, StakingRewardParticipantSDKType} from "@bze/bzejs/bze/rewards/store";
import BigNumber from "bignumber.js";

export interface NativeStakingData {
    averageApr: string;
    unlockDuration: string;
    totalStaked: Balance;
    minAmount: Balance;
    averageDailyDistribution: Balance;
    currentStaking?: UserNativeStakingData;
}

export interface UserNativeStakingData {
    staked: Balance;
    unbonding: NativeUnbondingSummary;
    pendingRewards: UserNativeStakingRewards;
}

export interface UserNativeStakingRewards {
    total: Balance;
    validators: string[];
}

export interface NativeUnbondingSummary {
    total: Balance;
    firstUnlock: {
        amount?: Balance;
        unlockTime?: Date;
    }
}

export interface AddressRewardsStaking {
    address: string;
    active: Map<string, StakingRewardParticipantSDKType>;
    unlocking: Map<string, ExtendedPendingUnlockParticipantSDKType[]>;
}

export interface ExtendedPendingUnlockParticipantSDKType extends PendingUnlockParticipantSDKType {
    unlockEpoch: BigNumber;
    rewardId: string;
}
