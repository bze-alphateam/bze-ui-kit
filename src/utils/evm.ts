import type {SkipChain} from '../types/cross_chain';

/**
 * Check whether a Skip chain is EVM-based.
 */
export const isEvmChain = (chain: SkipChain): boolean => {
    return chain.chain_type === 'evm';
};

/**
 * Convert a Skip chain ID string to a numeric EVM chain ID. Skip uses the
 * same numeric IDs as EVM but as strings (e.g. `"1"` for Ethereum mainnet,
 * `"56"` for BSC). Returns `undefined` if the string isn't a valid number
 * (i.e. it's a Cosmos chain ID like `"cosmoshub-4"`).
 */
export const skipChainIdToEvmChainId = (skipChainId: string): number | undefined => {
    const n = Number(skipChainId);
    if (Number.isNaN(n) || !Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return undefined;
    return n;
};

/**
 * Check if an address looks like a valid EVM hex address.
 */
export const isEvmAddress = (address: string): boolean => {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
};

/**
 * Minimal ERC-20 ABI for the `approve(address,uint256)` function.
 * Used by the EVM transaction hook to approve bridge/router contracts
 * before the actual bridge transaction.
 */
export const ERC20_APPROVE_ABI = [
    {
        type: 'function',
        name: 'approve',
        inputs: [
            {name: 'spender', type: 'address'},
            {name: 'amount', type: 'uint256'},
        ],
        outputs: [{name: '', type: 'bool'}],
        stateMutability: 'nonpayable',
    },
] as const;
