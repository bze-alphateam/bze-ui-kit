import {TendermintEvent} from "./events";

export interface BlockResults {
    result: {
        finalize_block_events: TendermintEvent[]
    }
}
