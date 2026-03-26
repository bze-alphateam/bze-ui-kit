# @bze/bze-ui-kit

Shared library for BZE ecosystem frontend apps (dex.getbze.com, burner.getbze.com).

## What this is

Shared code extracted from the dex and burner apps: hooks, utilities, query clients, services, types, constants, storage helpers, and common UI components (sidebars, toaster, highlight text). Both apps use Chakra UI v3.

## Structure

```
src/
  types/        # TypeScript interfaces (asset, balance, market, staking, events, burn, block, etc.)
  utils/        # Pure utility functions (amount math, formatting, denom helpers, etc.)
  constants/    # Chain config, endpoints, assets, keplr, testnet definitions, ecosystem nav
  storage/      # localStorage wrapper with TTL support + settings persistence
  service/      # Singleton services (AmmRouter, BlockchainEventManager, assets_factory, keplr)
  query/        # REST query clients (bank, staking, markets, pools, epochs, burner, raffle, block, module, etc.)
  hooks/        # React hooks (useAssets, useBalances, useMarkets, useToast, useTx, useEpochs, etc.)
  contexts/     # Base AssetsContextType + AssetsContext — each app provides its own AssetsProvider
  components/   # Shared UI components (Sidebar, WalletSidebar, SettingsSidebar, Toaster, HighlightText)
  index.ts      # Barrel exports (~170 exports)
```

## Build

```sh
npm run build     # tsup -> dist/ (CJS + ESM + .d.ts)
npm run dev       # tsup --watch
npm run lint      # tsc --noEmit
```

## Key design decisions

- **AssetsContext**: The lib exports the base type and React context object. Each app implements its own `AssetsProvider` because the dex and burner have different state (dex: locked liquidity, market filtering; burner: burns, raffles, pending contributions). Apps that extend the base `AssetsContextType` should use `extends BaseAssetsContextType` and provide a typed wrapper hook (see burner's `useBurnerContext`).
- **Sidebar components**: Accept `accentColor` prop (default `"blue"`) to match each app's brand (dex=blue, burner=orange). The Sidebar wrapper, WalletSidebarContent, SettingsSidebarContent, and SettingsToggle are all shared.
- **Toaster**: The lib creates and exports the Chakra toaster singleton + `<Toaster />` component. Each app must render `<Toaster />` in its layout.
- **Transaction hooks**: `useSDKTx`, `useBZETx`, `useIBCTx` are in the lib with `useToast` — both apps share them.
- **App-specific hooks NOT in the lib**: `useBlockchainListener` (different event subscriptions per app), `useNavigation` (different routes), and burner-specific hooks (`useBurningHistory`, `useNextBurning`, `useRaffles`).
- **Configurable per-app**: Call `setStorageKeyVersion()` and `setDefaultTxMemo()` at module scope in layout.tsx.
- **Peer dependencies**: React, @chakra-ui/react, next-themes, @bze/bzejs, bignumber.js, chain-registry, @interchain-kit/*, @cosmjs/stargate, interchainjs, react-icons are all peer deps — the consuming app provides them.
- **Next.js integration**: Consuming apps should add `transpilePackages: ["@bze/bze-ui-kit"]` and `optimizePackageImports: ["@bze/bze-ui-kit"]` to their next.config.ts.

## Publishing

```sh
# Bump version in package.json, then:
npm run build && npm publish
```

See README.md for full publish steps.
