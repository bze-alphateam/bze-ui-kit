import type { AllowedChain, TransferMechanism } from "../types/cross_chain";

export const BZE_SKIP_CHAIN_ID = 'beezee-1';
export const BZE_NATIVE_DENOM = 'ubze';

// ─── Allowlist ───
// Only chains and assets in this list are shown in the bridge UI.
// To add a new chain/asset, add an entry here.

const ALLOWED_CHAINS: AllowedChain[] = [
  {
    chainName: 'noble',
    displayName: 'Noble',
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/noble.svg',
    addressPrefix: 'noble',
    skipChainId: 'noble-1',
    isEvm: false,
    hasDirectIbc: true,
    assets: [
      {
        sourceDenom: 'uusdc',
        displayName: 'USD Coin',
        ticker: 'USDC',
        logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/USDCoin.svg',
        decimals: 6,
        bzeDenom: 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4',
      },
    ],
  },
  {
    chainName: 'osmosis',
    displayName: 'Osmosis',
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg',
    addressPrefix: 'osmo',
    skipChainId: 'osmosis-1',
    isEvm: false,
    hasDirectIbc: true,
    assets: [
      {
        sourceDenom: 'uosmo',
        displayName: 'Osmosis',
        ticker: 'OSMO',
        logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg',
        decimals: 6,
        bzeDenom: 'ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518',
      },
    ],
  },
  {
    chainName: 'atomone',
    displayName: 'AtomOne',
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/atomone/images/atomone.svg',
    addressPrefix: 'atone',
    skipChainId: '',  // NOT on Skip — pure IBC only
    isEvm: false,
    hasDirectIbc: true,
    assets: [
      {
        sourceDenom: 'uatone',
        displayName: 'AtomOne',
        ticker: 'ATONE',
        logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/atomone/images/atomone.svg',
        decimals: 6,
        bzeDenom: '', // TODO: fill with actual IBC denom on BZE once known
      },
    ],
  },
  {
    chainName: 'cosmoshub',
    displayName: 'Cosmos Hub',
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.svg',
    addressPrefix: 'cosmos',
    skipChainId: 'cosmoshub-4',
    isEvm: false,
    hasDirectIbc: true,
    assets: [
      {
        sourceDenom: 'uatom',
        displayName: 'Cosmos',
        ticker: 'ATOM',
        logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.svg',
        decimals: 6,
        bzeDenom: '', // TODO: fill with actual IBC denom on BZE once known
      },
    ],
  },
];

// ─── Helper Functions ───

export const getAllowedChains = (): AllowedChain[] => {
  return ALLOWED_CHAINS;
};

export const getAllowedChain = (chainName: string): AllowedChain | undefined => {
  return ALLOWED_CHAINS.find(c => c.chainName === chainName);
};

/** Chains that use Skip API for routing */
export const getSkipChains = (): AllowedChain[] => {
  return ALLOWED_CHAINS.filter(c => c.skipChainId !== '');
};

/** Chains that use pure IBC (not on Skip) */
export const getIbcOnlyChains = (): AllowedChain[] => {
  return ALLOWED_CHAINS.filter(c => c.skipChainId === '' && c.hasDirectIbc && !c.isEvm);
};

/** All Cosmos chains (Skip + IBC-only) */
export const getAllowedCosmosChains = (): AllowedChain[] => {
  return ALLOWED_CHAINS.filter(c => !c.isEvm);
};

/** All EVM chains */
export const getAllowedEvmChains = (): AllowedChain[] => {
  return ALLOWED_CHAINS.filter(c => c.isEvm);
};

/** Determine transfer mechanism for a chain */
export const getTransferMechanism = (chainName: string): TransferMechanism => {
  const chain = getAllowedChain(chainName);
  if (!chain) return 'ibc'; // fallback
  if (chain.skipChainId !== '') return 'skip';
  return 'ibc';
};

/** Whether the cross-chain bridge feature is enabled. Default: true. */
export const isCrossChainEnabled = (): boolean => {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CROSS_CHAIN_ENABLED !== undefined) {
    return process.env.NEXT_PUBLIC_CROSS_CHAIN_ENABLED !== 'false';
  }
  return true;
};

/** URL for the Skip API proxy in the consuming app */
const DEFAULT_SKIP_PROXY_URL = '/api/skip';

export const getSkipProxyUrl = (): string => {
  return typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SKIP_PROXY_URL
    ? process.env.NEXT_PUBLIC_SKIP_PROXY_URL
    : DEFAULT_SKIP_PROXY_URL;
};
