/**
 * Registers all BZE ecosystem message encoders and amino converters on a signing client.
 *
 * This is required because interchain-kit creates signing clients without any message
 * encoders pre-registered. Without this, signAndBroadcast and fee simulation will fail
 * with "No encoder/converter found for type" errors.
 *
 * Covers all modules used across dex.getbze.com, burner.getbze.com, app.getbze.com,
 * and stake.getbze.com. Add new message types here when new modules are introduced.
 */

// BZE modules
import {
    MsgCreateMarket, MsgCreateOrder, MsgCancelOrder, MsgFillOrders,
    MsgCreateLiquidityPool, MsgAddLiquidity, MsgRemoveLiquidity, MsgMultiSwap,
} from "@bze/bzejs/bze/tradebin/tx";
import {
    MsgCreateStakingReward, MsgUpdateStakingReward, MsgJoinStaking, MsgExitStaking,
    MsgClaimStakingRewards, MsgCreateTradingReward, MsgActivateTradingReward,
} from "@bze/bzejs/bze/rewards/tx";
import {MsgFundBurner, MsgStartRaffle, MsgJoinRaffle} from "@bze/bzejs/bze/burner/tx";
import {MsgCreateDenom, MsgMint, MsgBurn, MsgChangeAdmin, MsgSetDenomMetadata} from "@bze/bzejs/bze/tokenfactory/tx";
import {MsgAddArticle, MsgPayPublisherRespect, MsgAcceptDomain, MsgSavePublisher} from "@bze/bzejs/bze/cointrunk/tx";

// Cosmos modules
import {MsgSend, MsgMultiSend} from "@bze/bzejs/cosmos/bank/v1beta1/tx";
import {
    MsgDelegate, MsgUndelegate, MsgBeginRedelegate, MsgCancelUnbondingDelegation,
} from "@bze/bzejs/cosmos/staking/v1beta1/tx";
import {
    MsgSetWithdrawAddress, MsgWithdrawDelegatorReward, MsgWithdrawValidatorCommission,
    MsgFundCommunityPool,
} from "@bze/bzejs/cosmos/distribution/v1beta1/tx";
import {
    MsgSubmitProposal, MsgVote, MsgVoteWeighted, MsgDeposit, MsgCancelProposal,
} from "@bze/bzejs/cosmos/gov/v1/tx";
import {MsgGrant, MsgExec, MsgRevoke} from "@bze/bzejs/cosmos/authz/v1beta1/tx";
import {MsgGrantAllowance, MsgRevokeAllowance} from "@bze/bzejs/cosmos/feegrant/v1beta1/tx";

// IBC
import {MsgTransfer} from "@bze/bzejs/ibc/applications/transfer/v1/tx";

type MsgCodec = {
    typeUrl: string;
    aminoType?: string;
    fromPartial: (object: any) => any;
    encode: (message: any, writer?: any) => any;
    fromAmino?: (object: any) => any;
    toAmino?: (message: any) => any;
};

const toEncoder = (g: MsgCodec) => ({
    typeUrl: g.typeUrl,
    fromPartial: g.fromPartial,
    encode: (data: any) => {
        const encoded = g.encode(g.fromPartial(data));
        return encoded.finish ? encoded.finish() : encoded;
    },
});

const toConverter = (g: MsgCodec) => ({
    typeUrl: g.typeUrl,
    aminoType: g.aminoType,
    fromAmino: g.fromAmino,
    toAmino: g.toAmino,
});

const ALL_MSG_TYPES: MsgCodec[] = [
    // BZE tradebin
    MsgCreateMarket, MsgCreateOrder, MsgCancelOrder, MsgFillOrders,
    MsgCreateLiquidityPool, MsgAddLiquidity, MsgRemoveLiquidity, MsgMultiSwap,
    // BZE rewards
    MsgCreateStakingReward, MsgUpdateStakingReward, MsgJoinStaking, MsgExitStaking,
    MsgClaimStakingRewards, MsgCreateTradingReward, MsgActivateTradingReward,
    // BZE burner
    MsgFundBurner, MsgStartRaffle, MsgJoinRaffle,
    // BZE tokenfactory
    MsgCreateDenom, MsgMint, MsgBurn, MsgChangeAdmin, MsgSetDenomMetadata,
    // BZE cointrunk
    MsgAddArticle, MsgPayPublisherRespect, MsgAcceptDomain, MsgSavePublisher,
    // Cosmos bank
    MsgSend, MsgMultiSend,
    // Cosmos staking
    MsgDelegate, MsgUndelegate, MsgBeginRedelegate, MsgCancelUnbondingDelegation,
    // Cosmos distribution
    MsgSetWithdrawAddress, MsgWithdrawDelegatorReward, MsgWithdrawValidatorCommission,
    MsgFundCommunityPool,
    // Cosmos gov
    MsgSubmitProposal, MsgVote, MsgVoteWeighted, MsgDeposit, MsgCancelProposal,
    // Cosmos authz
    MsgGrant, MsgExec, MsgRevoke,
    // Cosmos feegrant
    MsgGrantAllowance, MsgRevokeAllowance,
    // IBC transfer
    MsgTransfer,
];

export const registerBzeEncoders = (client: any): void => {
    if (!client) return;
    client.addEncoders?.(ALL_MSG_TYPES.map(toEncoder));
    client.addConverters?.(ALL_MSG_TYPES.map(toConverter));
};
