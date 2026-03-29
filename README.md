# @bze/bze-ui-kit

Shared hooks, utilities, query clients, services, UI components, and types for BZE ecosystem frontend apps.

## Installation

```sh
npm install @bze/bze-ui-kit
```

### Peer dependencies

The consuming app must have these installed (they are **not** bundled):

```sh
npm install @bze/bzejs @chakra-ui/react bignumber.js chain-registry \
  @chain-registry/types @chain-registry/utils \
  @interchain-kit/core @interchain-kit/react \
  @interchainjs/cosmos @interchainjs/encoding \
  next-themes react react-dom react-icons
```

## Usage

```ts
import {
  // Configuration — call these early in your app (both optional)
  setStorageKeyVersion,
  setDefaultTxMemo,

  // Utils
  toBigNumber, prettyAmount, createMarketId, formatUsdAmount,

  // Query clients
  getMarkets, getLiquidityPools, getAddressBalances, getBZEUSDPrice,

  // Hooks
  useAssets, useBalances, useMarkets, useLiquidityPools,
  useWalletHealthCheck,

  // Context (provide your own AssetsProvider)
  AssetsContext,

  // Types
  type Asset, type Market, type Balance,
} from '@bze/bze-ui-kit';
```

### App initialization

Each app must configure the library at startup:

```ts
// In your app's entry point (e.g., layout.tsx)
import { setStorageKeyVersion, setDefaultTxMemo } from '@bze/bze-ui-kit';

// Set a unique storage prefix to avoid localStorage collisions between apps
setStorageKeyVersion('3');  // dex uses '3', burner uses '2'

// Optional — transaction memo defaults to NEXT_PUBLIC_APP_NAME if set.
// Only needed if you want a value different from the app name env var.
setDefaultTxMemo('dex.getbze.com');
```

### AssetsProvider

The library exports `AssetsContext` and `AssetsContextType` but each app implements its own `AssetsProvider`. This is because dex and burner have different app-specific state on top of the shared base.

### Wallet health check

Call `useWalletHealthCheck()` in a top-level always-mounted component (e.g. `BlockchainListenerWrapper`) to proactively detect and clear stale wallet state restored from localStorage (e.g. extension locked after leaving the page for hours):

```ts
import { useWalletHealthCheck } from '@bze/bze-ui-kit';

export function BlockchainListenerWrapper() {
  useWalletHealthCheck();
  // ...
}
```

### Blockchain event subscriptions

Use `subscribeToBlockchainEvents` to subscribe to CometBFT events via a shared WebSocket singleton (one persistent connection reused across the whole app):

```ts
import { subscribeToBlockchainEvents, getSettings } from '@bze/bze-ui-kit';

const unsubscribe = await subscribeToBlockchainEvents(
  getSettings().endpoints.rpcEndpoint,
  "tm.event='NewBlock'",
  (result) => { /* handle result.data.value */ }
);

// Later:
unsubscribe();
```

The singleton handles reconnection with exponential backoff and automatically resubscribes active subscriptions after reconnect.

### Event helper functions

Use these to filter CometBFT events in your blockchain listener:

```ts
import {
  isAddressTransfer, isBurnEvent, isCoinbaseEvent, isEpochStartEvent,
  isOrderBookEvent, isOrderExecutedEvent, isSwapEvent,
  getMintedAmount, getEventMarketId, getEventKeyValue,
} from '@bze/bze-ui-kit';
```

## What's included

| Module | Description |
|--------|-------------|
| `types/` | TypeScript interfaces for assets, balances, markets, pools, staking, IBC, events, settings, burn, block |
| `utils/` | Pure functions: amount math, denom helpers, formatting, address validation, staking APR, chart periods, event filters |
| `constants/` | Chain config, RPC/REST endpoints, asset lists, keplr fallbacks, testnet, ecosystem navigation |
| `storage/` | localStorage wrapper with TTL + app settings persistence |
| `service/` | AmmRouter (Dijkstra swap routing), BlockchainEventManager (pub-sub), assets_factory, keplr suggest chain |
| `query/` | REST clients for bank, staking, markets, liquidity pools, epochs, IBC, burner, raffle, block, module, rewards, aggregator, prices |
| `hooks/` | React hooks: useAssets, useBalances, useMarkets, useLiquidityPools, useLiquidityPool, usePrices, useEpochs, useSigningClient, useWalletHealthCheck, useSettings, useFeeTokens, useAssetsValue, useConnectionType, useToast, useSDKTx/useBZETx/useIBCTx |
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
| `NEXT_PUBLIC_LOCKER_ADDRESS` | `bze1pc5zjcvhx3e8l305zjl72grytfa30r5mdypmw4` | Locker module address |
| `NEXT_PUBLIC_APP_NAME` | `BZE` | Display name and default transaction memo |
| `NEXT_PUBLIC_GAS_MULTIPLIER` | `1.5` | Multiplier applied to simulated gas estimates |

### BZE endpoints

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_REST_URL` | _(empty)_ | Default BZE REST endpoint |
| `NEXT_PUBLIC_RPC_URL` | _(empty)_ | Default BZE RPC endpoint |
| `NEXT_PUBLIC_REST_ENDPOINT` | _(empty)_ | User-configurable REST endpoint (settings default) |
| `NEXT_PUBLIC_RPC_ENDPOINT` | _(empty)_ | User-configurable RPC/WebSocket endpoint (settings default) |
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

### Ecosystem navigation

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_ECOSYSTEM_EXCLUDED` | _(empty)_ | Comma-separated keys to hide (e.g. `staking,factory`). Valid: `website`, `staking`, `dex`, `burner`, `factory` |
| `NEXT_PUBLIC_ECOSYSTEM_LINK_{KEY}` | _(per app)_ | Override URL for an app (e.g. `NEXT_PUBLIC_ECOSYSTEM_LINK_WEBSITE`) |
| `NEXT_PUBLIC_ECOSYSTEM_LABEL_{KEY}` | _(per app)_ | Override display label (e.g. `NEXT_PUBLIC_ECOSYSTEM_LABEL_DEX`) |

### AtomOne validator (dex-only)

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_ATONE_VALIDATOR_SUPPORTED_DENOMS` | _(empty)_ | Comma-separated denoms supported by BZE validator |
| `NEXT_PUBLIC_ATONE_VALIDATOR_PAGE_URL` | _(empty)_ | URL to the validator page |

## What stays app-specific

These are **not** in the library — each app keeps its own:

- **useBlockchainListener** — different WebSocket event subscriptions per app; built on top of `subscribeToBlockchainEvents` from the lib
- **useNavigation** — completely different route structures
- **AssetsProvider** (`contexts/assets_context.tsx`) — each app extends the shared base `AssetsContextType` with app-specific state
- **Burner-only**: `useBurnerContext`, `useBurningHistory`, `useNextBurning`, `useRaffles`
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

Add a publish token to `~/.npmrc` so `npm publish` never prompts for login:

```sh
echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN" >> ~/.npmrc
```

Generate the token at npmjs.com → your avatar → Access Tokens → Generate New Token → Classic → Publish.

### Steps

```sh
# 1. Bump the version in package.json, then:
npm run build && npm publish
```

## License

MIT
