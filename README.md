# @bze/bze-ui-kit

Shared hooks, utilities, query clients, services, UI components, and types for BZE ecosystem frontend apps.

## Installation

```sh
npm install @bze/bze-ui-kit
```

### Peer dependencies

The consuming app must have these installed (they are **not** bundled):

```sh
npm install @bze/bzejs @chakra-ui/react @cosmjs/stargate bignumber.js chain-registry \
  @chain-registry/types @chain-registry/utils @chain-registry/v2 \
  @interchain-kit/core @interchain-kit/react @interchainjs/encoding \
  interchainjs next-themes react react-dom react-icons
```

## Usage

```ts
import {
  // Configuration — call these early in your app
  setStorageKeyVersion,
  setDefaultTxMemo,

  // Utils
  toBigNumber, prettyAmount, createMarketId, formatUsdAmount,

  // Query clients
  getMarkets, getLiquidityPools, getAddressBalances, getBZEUSDPrice,

  // Hooks
  useAssets, useBalances, useMarkets, useLiquidityPools,

  // Context (provide your own AssetsProvider)
  AssetsContext,

  // Types
  type Asset, type Market, type Balance,
} from '@bze/bze-ui-kit';
```

### App initialization

Each app must configure the library at startup:

```ts
// In your app's entry point (e.g., layout.tsx or _app.tsx)
import { setStorageKeyVersion, setDefaultTxMemo } from '@bze/bze-ui-kit';

// Set a unique storage prefix to avoid localStorage collisions between apps
setStorageKeyVersion('3');  // dex uses '3', burner uses '2'

// Set the default transaction memo
setDefaultTxMemo('dex.getbze.com');
```

### AssetsProvider

The library exports the `AssetsContext` and `AssetsContextType` but each app must implement its own `AssetsProvider`. This is because the dex and burner have different app-specific state on top of the shared base.

## What's included

| Module | Description |
|--------|-------------|
| `types/` | TypeScript interfaces for assets, balances, markets, pools, staking, IBC, events, settings, burn, block |
| `utils/` | Pure functions: amount math, denom helpers, formatting, address validation, staking APR, chart periods |
| `constants/` | Chain config, RPC/REST endpoints, asset lists, keplr fallbacks, testnet, ecosystem navigation |
| `storage/` | localStorage wrapper with TTL + app settings persistence |
| `service/` | AmmRouter (Dijkstra swap routing), BlockchainEventManager (pub-sub), assets_factory, keplr suggest chain |
| `query/` | REST clients for bank, staking, markets, liquidity pools, epochs, IBC, burner, raffle, block, module, rewards, aggregator, prices |
| `hooks/` | React hooks: useAssets, useBalances, useMarkets, useLiquidityPools, useLiquidityPool, usePrices, useEpochs, useSigningClient, useSettings, useFeeTokens, useAssetsValue, useConnectionType, useToast, useSDKTx/useBZETx/useIBCTx |
| `contexts/` | Base `AssetsContextType` interface + `AssetsContext` React context |
| `components/` | Sidebar, WalletSidebarContent, SettingsSidebarContent, SettingsToggle, Toaster, HighlightText |

## Required environment variables

The library reads these `NEXT_PUBLIC_*` env vars at build time (inlined by Next.js). The consuming app must define them in its `.env` file.

### Chain configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_CHAIN_ID` | `beezee-1` | Chain ID |
| `NEXT_PUBLIC_CHAIN_NAME` | `beezee` | Chain name (must match chain-registry) |
| `NEXT_PUBLIC_CHAIN_IS_TESTNET` | `false` | Set to `true` or `1` for testnet |
| `NEXT_PUBLIC_CHAIN_ADDRESS_PREFIX` | `bze` | Bech32 address prefix |
| `NEXT_PUBLIC_CHAIN_NATIVE_ASSET_DENOM` | `ubze` | Native staking/fee denom |
| `NEXT_PUBLIC_USDC_IBC_DENOM` | _(empty)_ | IBC denom for USDC on BZE chain |
| `NEXT_PUBLIC_EXPLORER_URL` | `https://explorer.chaintools.tech` | Block explorer base URL |
| `NEXT_PUBLIC_WALLET_CHAINS_NAMES` | _(auto)_ | Comma-separated chain names for wallet connection |
| `NEXT_PUBLIC_LOCKER_ADDRESS` | `bze1pc5zjcvhx3e8l305zjl72grytfa30r5mdypmw4` | Locker module address (used by dex for locked balances) |
| `NEXT_PUBLIC_APP_NAME` | `BZE` | Display name shown in settings UI |

### BZE endpoints

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_REST_URL` | _(empty)_ | Default BZE REST endpoint |
| `NEXT_PUBLIC_RPC_URL` | _(empty)_ | Default BZE RPC endpoint |
| `NEXT_PUBLIC_REST_ENDPOINT` | _(empty)_ | User-configurable REST endpoint (settings default) |
| `NEXT_PUBLIC_RPC_ENDPOINT` | _(empty)_ | User-configurable RPC endpoint (settings default) |
| `NEXT_PUBLIC_AGG_API_HOST` | `https://getbze.com` | Aggregator API host for prices/tickers |

### IBC chain endpoints

| Env var | Description |
|---------|-------------|
| `NEXT_PUBLIC_RPC_URL_ARCHWAY` | Archway RPC |
| `NEXT_PUBLIC_RPC_URL_OSMOSIS` | Osmosis RPC |
| `NEXT_PUBLIC_RPC_URL_NOBLE` | Noble RPC |
| `NEXT_PUBLIC_RPC_URL_JACKAL` | Jackal RPC |
| `NEXT_PUBLIC_RPC_URL_FLIX` | OmniFlix RPC |
| `NEXT_PUBLIC_RPC_URL_ATOMONE` | AtomOne RPC |
| `NEXT_PUBLIC_REST_URL_ARCHWAY` | Archway REST |
| `NEXT_PUBLIC_REST_URL_OSMOSIS` | Osmosis REST |
| `NEXT_PUBLIC_REST_URL_NOBLE` | Noble REST |
| `NEXT_PUBLIC_REST_URL_JACKAL` | Jackal REST |
| `NEXT_PUBLIC_REST_URL_FLIX` | OmniFlix REST |
| `NEXT_PUBLIC_REST_URL_ATOMONE` | AtomOne REST |

### AtomOne validator (dex-only)

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_ATONE_VALIDATOR_SUPPORTED_DENOMS` | _(empty)_ | Comma-separated denoms supported by BZE validator |
| `NEXT_PUBLIC_ATONE_VALIDATOR_PAGE_URL` | _(empty)_ | URL to the validator page |

## What stays app-specific

These are **not** in the library — each app keeps its own:

- **useBlockchainListener** — different WebSocket event subscriptions per app
- **useNavigation** — completely different route structures
- **AssetsProvider** (`contexts/assets_context.tsx`) — each app composes the shared base `AssetsContextType` with app-specific state
- **Burner-only**: `useBurnerContext` (typed wrapper for extended context), `useBurningHistory`, `useNextBurning`, `useRaffles`
- **Dex-only**: `useLockedLiquidity`, `useNativeStakingData`, `useRewardsStakingData`

## Development

```sh
# Install dependencies
npm install

# Build (CJS + ESM + type declarations)
npm run build

# Watch mode for development
npm run dev

# Type-check without emitting
npm run lint
```

## Build & Publish to npm

### Prerequisites

1. Make sure you are logged in to npm:
   ```sh
   npm login
   ```

2. Verify you have publish access to the `@bze` scope:
   ```sh
   npm access list packages @bze
   ```

### Steps

```sh
# 1. Make sure you're on a clean state
git status

# 2. Update the version in package.json
#    For a patch release:
npm version patch
#    For a minor release:
npm version minor
#    For a major release:
npm version major

# 3. Build the library
npm run build

# 4. Verify the build output looks correct
ls -la dist/
# Should contain: index.js, index.mjs, index.d.ts, index.d.mts, and source maps

# 5. Do a dry run to see what would be published
npm publish --dry-run

# 6. Publish to npm
npm publish

# 7. Verify the published package
npm view @bze/bze-ui-kit
```

### Quick one-liner

```sh
npm version patch && npm run build && npm publish
```

## License

MIT
