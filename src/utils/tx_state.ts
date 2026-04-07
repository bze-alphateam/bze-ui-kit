import type {CrossChainTxState} from '../types/cross_chain';

/** Terminal states — polling stops, no further changes expected. */
const TERMINAL_STATES: CrossChainTxState[] = ['completed', 'failed', 'abandoned'];

/** Whether a tx state is terminal (completed, failed, or abandoned). */
export const isTerminalState = (state: CrossChainTxState): boolean =>
    TERMINAL_STATES.includes(state);

/** Whether a tx is still in progress (not terminal). */
export const isPendingState = (state: CrossChainTxState): boolean =>
    !isTerminalState(state);

/** Human-readable label for a tx state. */
export const txStateLabel = (state: string): string => {
    switch (state) {
        case 'signing': return 'Signing';
        case 'broadcasting': return 'Broadcasting';
        case 'submitted': return 'Submitted';
        case 'pending': return 'In Progress';
        case 'completed': return 'Completed';
        case 'failed': return 'Failed';
        case 'abandoned': return 'Abandoned';
        default: return state;
    }
};

/** Chakra color palette name for a tx state badge. */
export const txStateColor = (state: string): string => {
    switch (state) {
        case 'completed': return 'green';
        case 'failed':
        case 'abandoned': return 'red';
        default: return 'blue';
    }
};
