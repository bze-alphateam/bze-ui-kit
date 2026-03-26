import {getPageRequestWithLimit, getRestClient} from "./client";
import {QueryDenomsMetadataRequest, QueryTotalSupplyRequest} from "@bze/bzejs/cosmos/bank/v1beta1/query";

const {fromPartial: TotalSupplyRequest} = QueryTotalSupplyRequest;
const {fromPartial: MetadataRequest} = QueryDenomsMetadataRequest;

const DEFAULT_LIMIT = 200;

export const getAllSupply = async () => {
    try {
        const client = await getRestClient();
        const resp = await client.cosmos.bank.v1beta1.totalSupply(TotalSupplyRequest(
            {pagination: getPageRequestWithLimit(DEFAULT_LIMIT)})
        );

        return resp.supply;
    } catch (error) {
        console.error('failed to get supply: ', error);
    }

    return undefined
}

export const getAllSupplyMetadata = async () => {
    try {
        const client = await getRestClient();
        const resp = await client.cosmos.bank.v1beta1.denomsMetadata(MetadataRequest({
            pagination: getPageRequestWithLimit(DEFAULT_LIMIT)
        }))

        return resp.metadatas;
    } catch (error) {
        console.error('failed to get supply metadata: ', error);
    }

    return undefined
}
