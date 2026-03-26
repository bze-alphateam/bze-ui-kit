import {RaffleSDKType, RaffleWinnerSDKType} from "@bze/bzejs/bze/burner/raffle";
import {getRestClient} from "./client";
import {getBlockResults} from "./block";
import {mapEventAttributes} from "../utils/events";

export async function getRaffles(): Promise<RaffleSDKType[]> {
    try {
        const client = await getRestClient();
        const response = await client.bze.burner.raffles();

        return response.list;
    } catch (e) {
        console.error(e);

        return [];
    }
}

export async function getRaffleWinners(denom: string): Promise<RaffleWinnerSDKType[]> {
    try {
        const client = await getRestClient();
        const response = await client.bze.burner.raffleWinners({denom: denom});
        return response.list;
    } catch (e) {
        console.error(e);

        return [];
    }
}

interface RaffleResult {
    hasWon: boolean;
    amount: string;
    denom: string;
    address: string;
}

export async function checkAddressWonRaffle(address: string, denom: string, height: number): Promise<RaffleResult|undefined> {
    const response = {
        hasWon: false,
        amount: "0",
        denom: denom,
        address: address,
    };
    if (address == "" || height <= 0) {
        return undefined;
    }

    const blockResults = await getBlockResults(height);
    if (!blockResults) {
        return undefined;
    }

    if (!blockResults.result?.finalize_block_events) {
        return undefined;
    }

    if (blockResults.result.finalize_block_events.length === 0) {
        return undefined;
    }

    const raffleEvents = blockResults.result.finalize_block_events.filter(ev => ev.type.includes('Raffle'));
    if (!raffleEvents || raffleEvents.length === 0) {
        return undefined;
    }

    for (let i = 0; i < raffleEvents.length; i++) {
        const ev = raffleEvents[i];
        const converted = mapEventAttributes(ev.attributes)
        if ('participant' in converted && ev.type.includes('RaffleLostEvent') && converted['participant'] === address) {
            return response;
        }

        if ('winner' in converted && ev.type.includes('RaffleWinnerEvent') && converted['winner'] === address && converted['denom'] === denom) {
            response.hasWon = true;
            response.amount = converted['amount'];
            return response;
        }
    }

    return response;
}
