import BigNumber from "bignumber.js";
import {PoolSDKType} from "@bze/bzejs/cosmos/staking/v1beta1/staking";
import {StakingRewardParticipantSDKType, StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";

const DAY_TO_SECONDS = 24 * 60 * 60;

export const calcNativeStakingApr = (pool: PoolSDKType, communityTax: string, annualProvisions: BigNumber) => {
    const totalSupply = new BigNumber(pool?.bonded_tokens || 0).plus(
        pool?.not_bonded_tokens || 0
    );

    if (totalSupply.isZero() || annualProvisions.isZero()) {
        return "0.00";
    }

    const bondedTokens = new BigNumber(pool?.bonded_tokens || 0);

    if (bondedTokens.isZero()) {
        return "0.00";
    }

    const bondedTokensRatio = bondedTokens.div(totalSupply);
    const inflation = annualProvisions.div(totalSupply);
    const communityTaxRate = new BigNumber(communityTax || 0);

    const apr = inflation
        .multipliedBy(new BigNumber(1).minus(communityTaxRate))
        .div(bondedTokensRatio)
        .multipliedBy(100)
        .decimalPlaces(2, BigNumber.ROUND_DOWN);

    return apr.toString();
};

export const parseUnbondingDays = (unbondingTime: string) => {
    const split = unbondingTime.split("s");

    return new BigNumber(split[0] || 0)
        .div(DAY_TO_SECONDS)
        .decimalPlaces(0)
        .toString();
};

export const calculateRewardsStakingApr = (dailyAmount: string | number | BigNumber, staked: string | number | BigNumber): BigNumber => {
    const stakedNum = new BigNumber(staked);
    let computedApr = new BigNumber(dailyAmount).dividedBy(stakedNum).multipliedBy(365).multipliedBy(100);

    if (computedApr.lt(1)) {
        computedApr = computedApr.decimalPlaces(6);
    } else {
        computedApr = computedApr.decimalPlaces(2);
    }

    return computedApr;
}

export const calculateRewardsStakingPendingRewards = (stakingReward?: StakingRewardSDKType, userStake?: StakingRewardParticipantSDKType): BigNumber => {
    const distr = new BigNumber(stakingReward?.distributed_stake || 0);
    const joinedAt = new BigNumber(userStake?.joined_at || 0);
    if (distr.isEqualTo(joinedAt)) {
        return new BigNumber(0);
    }

    const deposited = new BigNumber(userStake?.amount || 0);

    return deposited.multipliedBy(distr.minus(joinedAt)).decimalPlaces(0);
}
