import {getRestClient} from "./client";
import {Coin} from "@bze/bzejs/cosmos/base/v1beta1/coin";
import {getLockerAddress} from "../constants/chain";

export async function getAddressBalances(address: string): Promise<Coin[]> {
    try {
        const client = await getRestClient();
        const response = await client.cosmos.bank.v1beta1.spendableBalances({address: address});

        return response.balances;
    } catch (e) {
        console.error("failed to get balances",e);

        return [];
    }
}

export async function getLockedBalances(): Promise<Coin[]> {
    try {
        const lockerAddress = getLockerAddress();
        if (!lockerAddress) {
            console.warn("Locker address not configured");
            return [];
        }

        return await getAddressBalances(lockerAddress);
    } catch (e) {
        console.error("failed to get locked balances", e);
        return [];
    }
}
