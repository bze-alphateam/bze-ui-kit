import {IBCData} from "../types/asset";
import {DenomTrace} from "../types/ibc";
import BigNumber from "bignumber.js";

export const canDepositFromIBC = (ibcData: IBCData): boolean => {
    return ibcData.counterparty.baseDenom !== "" && ibcData.counterparty.channelId !== "" && ibcData.counterparty.chainName != ""
}

export const canSendToIBC = (ibcData: IBCData): boolean => {
    return ibcData.chain.channelId !== "" && ibcData.counterparty.chainName != ""
}

/** Compute the denom on the first-hop (counterparty) chain, using only this trace. */
export async function denomOnFirstHopChainFromTrace(trace: DenomTrace): Promise<string | undefined> {
    try {
        if (!trace?.base_denom) return undefined;

        const parts = trace.path.split("/").filter(Boolean);
        if (parts.length < 2) {
            return trace.base_denom || undefined;
        }

        const remaining = parts.slice(2);
        if (remaining.length === 0) {
            return trace.base_denom;
        }

        const remainingPath = remaining.join("/");
        const full = `${remainingPath}/${trace.base_denom}`;

        const enc = new TextEncoder();
        const buf = enc.encode(full);
        const digest = await crypto.subtle.digest("SHA-256", buf);

        const hashBytes = new Uint8Array(digest);
        let hex = "";
        for (let i = 0; i < hashBytes.length; i++) {
            const b = hashBytes[i].toString(16).padStart(2, "0");
            hex += b;
        }
        return `ibc/${hex.toUpperCase()}`;
    } catch (e) {
        console.error("[denomOnFirstHopChainFromTrace] error:", e);
        return undefined;
    }
}

export const getIbcTransferTimeout = (): BigNumber => {
    return new BigNumber(Date.now() + 600_000).multipliedBy(1_000_000)
}
