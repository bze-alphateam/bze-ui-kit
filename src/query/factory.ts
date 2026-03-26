import {getRestClient} from "./client";

export async function getFactoryDenomAdminAddress(denom: string): Promise<string> {
    try {
        const client = await getRestClient();
        const res = await client.bze.tokenfactory.denomAuthority({denom: denom});

        return res.denomAuthority?.admin ?? ''
    } catch (e) {
        console.error(e);

        return '';
    }
}
