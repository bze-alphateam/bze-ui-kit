# Implementation Plan: cosmos.directory Fallback for Unknown IBC Assets

## Context

When a new blockchain connects to BZE via IBC, the DEX app needs to display the new asset with proper name, ticker, decimals, and logo. Currently, the app relies on the static `@chain-registry/v2` npm package which only knows about chains/assets at the time of install. If an IBC asset comes from a chain not yet in the installed package version, the asset displays with a truncated raw denom, 0 decimals, no logo, and no IBC transfer capability.

This plan adds a **client-side fallback** to [cosmos.directory](https://cosmos.directory) that fetches asset metadata at runtime when the static chain-registry data doesn't have what we need. Results are cached in localStorage for 30 days.

## Target Codebase

All changes are in `bze-ui-kit` (the shared library at `/Users/stefan.balea/projects/bze-ecosystem/bze-ui-kit`).

## Architecture Overview

The current IBC asset resolution flow in `src/service/assets_factory.ts` → `populateIBCAsset()` has this pipeline:

1. **Tier 1 (lines 77-105):** Look up the IBC denom in the static `@chain-registry/v2` IBC asset list via `getIBCAssetList()`. If found with valid traces and the counterparty chain exists in static `getChains()`, populate the asset fully. **Return early.**
2. **Tier 2 (lines 107-164):** Query the on-chain IBC trace (`getHashIBCTrace`), resolve counterparty chain info from on-chain data (`counterpartyChainForChannel`), then search the static `getAssetLists()` for matching `base_denom`. Also tries `populateAssetFromBZEChainRegistryAssetList`. **Return if found.**
3. **Tier 3 (lines 166-177):** Graceful degradation — truncated `base_denom` as name, `decimals: 0`, `verified: false`.

The fallback should be inserted **between the current Tier 2 asset list search (line 144) and Tier 3 (line 166)**, so it only fires when the static chain-registry data has no match but we DO have the on-chain IBC trace with `base_denom` and counterparty `chainId`.

---

## Step 1: Create a new query module for cosmos.directory

**Create file:** `src/query/cosmos_directory.ts`

This module handles fetching chain and asset data from the cosmos.directory API with localStorage caching.

### Types to define in this file

```typescript
interface CosmosDirectoryChain {
  name: string;           // chain registry name (e.g., "lumen")
  chain_name: string;     // same as name
  chain_id: string;       // e.g., "lumen-1"
  pretty_name: string;    // e.g., "Lumen"
  assets: CosmosDirectoryAsset[];
}

interface CosmosDirectoryAsset {
  base: string;           // base denom (e.g., "ulumen")
  name: string;           // display name (e.g., "Lumen")
  display: string;        // display denom
  symbol: string;         // ticker (e.g., "LUMEN")
  denom_units: { denom: string; exponent: number }[];
  logo_URIs?: { svg?: string; png?: string };
}
```

Note: Verify the exact response shape by inspecting `https://chains.cosmos.directory` at implementation time. The types above are based on research but the actual field names and nesting may differ slightly. **Fetch the URL once manually or via `curl` and verify the JSON structure before coding.**

### Cache constants

```typescript
const COSMOS_DIR_CHAINS_CACHE_KEY = "cosmos_directory:chains";
const COSMOS_DIR_CHAINS_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
const COSMOS_DIR_CHAIN_ASSETS_CACHE_KEY_PREFIX = "cosmos_directory:chain_assets:";
const COSMOS_DIR_CHAIN_ASSETS_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
const COSMOS_DIR_CHAINS_URL = "https://chains.cosmos.directory";
```

### Functions to implement

#### `getCosmosDirectoryChainByChainId(chainId: string): Promise<CosmosDirectoryChain | undefined>`

1. Check localStorage for `COSMOS_DIR_CHAINS_CACHE_KEY` using the existing `getFromLocalStorage()` utility.
2. If cache hit, parse the JSON array, find the chain where `chain_id === chainId`, and return it.
3. If cache miss:
   - Fetch `https://chains.cosmos.directory`
   - The response has a `chains` array at the top level (verify this)
   - Store the full `chains` array in localStorage with 30-day TTL using `setInLocalStorage()`
   - Find and return the matching chain
4. Wrap everything in try/catch. On any error, log a warning and return `undefined`. This is a fallback — it must never break the main flow.

**Important:** The full chains list can be large. If localStorage quota is a concern, consider storing only a map of `chainId -> { name, pretty_name }` instead of the full response. But try the full response first — localStorage typically allows 5-10MB which should be plenty.

#### `getCosmosDirectoryAssetsByChainName(chainName: string): Promise<CosmosDirectoryAsset[] | undefined>`

1. Check localStorage for `${COSMOS_DIR_CHAIN_ASSETS_CACHE_KEY_PREFIX}${chainName}`.
2. If cache hit, parse and return.
3. If cache miss:
   - Fetch `https://chains.cosmos.directory/${chainName}/assets` (verify this URL returns the asset list, or use `https://chains.cosmos.directory/${chainName}` and extract assets from the response)
   - Store assets in localStorage with 30-day TTL
   - Return the assets array
4. Wrap in try/catch, return `undefined` on error.

**Alternative approach:** If the top-level `https://chains.cosmos.directory` response already includes inline `assets` for each chain (verify this), you might not need this second function at all — just extract assets from the cached chains list in `getCosmosDirectoryChainByChainId`. Evaluate which approach works best based on the actual API response.

---

## Step 2: Create a helper function to populate an asset from cosmos.directory data

**Create file or add to:** `src/service/assets_factory.ts` (add as a private function)

### Function: `populateAssetFromCosmosDirectory(asset: Asset, ibcTrace: DenomTrace, counterpartyChainId: string): Promise<Asset | undefined>`

This function attempts to resolve the asset metadata from cosmos.directory when the static chain-registry has no data.

**Parameters:**
- `asset`: The partially populated Asset object (already has `denom`, `IBCData` with `chain.channelId`)
- `ibcTrace`: The on-chain IBC trace (has `base_denom` and `path`)
- `counterpartyChainId`: The chain ID of the counterparty chain (e.g., `"lumen-1"`), obtained from the existing `counterpartyChainForChannel()` call

**Logic:**

1. Call `getCosmosDirectoryChainByChainId(counterpartyChainId)` from the new query module.
2. If no chain found, return `undefined`.
3. Populate `asset.IBCData.counterparty.chainName` and `asset.IBCData.counterparty.chainPrettyName` from the cosmos.directory chain data (`chain.name` and `chain.pretty_name`).
4. Get the asset list — either from the inline chain data or via `getCosmosDirectoryAssetsByChainName(chain.name)`.
5. Find the asset in the list where `base === ibcTrace.base_denom`.
6. If found, populate the asset:
   - `asset.name = cosmosAsset.name`
   - `asset.ticker = cosmosAsset.symbol.toUpperCase()`
   - `asset.decimals = ` the exponent of the denom_unit matching `cosmosAsset.display` (find the entry in `denom_units` where `denom === display`, take its `exponent`; default to `0` if not found)
   - `asset.logo = cosmosAsset.logo_URIs?.svg ?? cosmosAsset.logo_URIs?.png ?? TOKEN_LOGO_PLACEHOLDER`
   - `asset.verified = false` (keep it unverified since it's from an external fallback, not from the curated chain-registry package)
7. Return the asset.
8. If asset not found in the list, still populate the chain name/pretty name on `IBCData` and return `undefined` (so the caller can still benefit from the chain info even if the specific asset wasn't found).

---

## Step 3: Integrate the fallback into `populateIBCAsset()`

**File:** `src/service/assets_factory.ts`

**Current code at lines 134-164:**

```typescript
const counterPartyChain = await counterpartyChainForChannel(splitPath[1], splitPath[0])
if (counterPartyChain) {
    asset.IBCData.counterparty.channelId = counterPartyChain.channelId
    const fullChain = getChainByChainId(counterPartyChain.chainId)
    if (fullChain) {
        asset.IBCData.counterparty.chainName = fullChain.chainName
        asset.IBCData.counterparty.chainPrettyName = fullChain.prettyName ?? fullChain.chainName
    }
}

const registryAssetChain = getAssetLists().find((item) => {
    const a = item.assets.find((i) => i.base === ibcTrace.base_denom)
    return !!a;
})

if (registryAssetChain) {
    // ... populate from registry and return
}

const localAsset = await populateAssetFromBZEChainRegistryAssetList(asset)
if (localAsset) {
    localAsset.verified = true
    return localAsset
}

// Tier 3 degradation follows...
```

**Insert the cosmos.directory fallback AFTER the `populateAssetFromBZEChainRegistryAssetList` check (line 164) and BEFORE the Tier 3 degradation (line 166).**

Add this block:

```typescript
// Fallback: try cosmos.directory for chains/assets not in the static chain-registry package
if (counterPartyChain?.chainId) {
    const cosmosDirectoryAsset = await populateAssetFromCosmosDirectory(asset, ibcTrace, counterPartyChain.chainId)
    if (cosmosDirectoryAsset) {
        return cosmosDirectoryAsset
    }
}
```

**Note:** The `counterPartyChain` variable is already available from the earlier block (line 134). Use its `chainId` to pass to the fallback. If `counterPartyChain` is undefined (the on-chain resolution failed), skip the fallback entirely — there's nothing to look up.

Also note: even if `populateAssetFromCosmosDirectory` returns `undefined` (asset not found), the chain name/pretty name may have been populated on `asset.IBCData` as a side effect (see Step 2 point 8). This means even in Tier 3 degradation, the user will see the counterparty chain's pretty name instead of "Unknown chain".

---

## Step 4: Handle the chain name population for IBCData even when static registry misses

**Current issue:** At line 137-141, the code only populates `chainName` and `chainPrettyName` if `getChainByChainId()` finds the chain in the static package. If it doesn't (new chain), these fields stay empty, which breaks `canDepositFromIBC()` and `canSendToIBC()`.

The cosmos.directory fallback in Step 3 will handle this as a side effect. But to be explicit, inside `populateAssetFromCosmosDirectory`, when the chain is found on cosmos.directory, **always populate:**

```typescript
asset.IBCData.counterparty.chainName = chain.name
asset.IBCData.counterparty.chainPrettyName = chain.pretty_name
```

This ensures IBC deposit/withdraw functions work even if the specific asset metadata isn't found.

---

## Step 5: Export the new query functions (optional, for testability)

**File:** `src/index.ts`

If you want apps to be able to use or test the cosmos.directory functions directly, add to the query exports section:

```typescript
export { getCosmosDirectoryChainByChainId, getCosmosDirectoryAssetsByChainName } from './query/cosmos_directory';
```

This is optional — the fallback works internally without exporting these.

---

## Summary of files to change

| File | Action |
|------|--------|
| `src/query/cosmos_directory.ts` | **CREATE** — cosmos.directory fetch + localStorage cache logic |
| `src/service/assets_factory.ts` | **EDIT** — add `populateAssetFromCosmosDirectory()` function + integrate into `populateIBCAsset()` after line 164 |
| `src/index.ts` | **EDIT (optional)** — export new query functions |

## Important implementation notes

1. **Verify the cosmos.directory API response structure** before coding. Fetch `https://chains.cosmos.directory` and `https://chains.cosmos.directory/{chainName}` manually and check the exact field names and nesting. The types in Step 1 are estimates.

2. **Error handling must be bulletproof.** Every fetch and JSON parse in the new code must be wrapped in try/catch. The fallback must NEVER cause the asset factory to throw. If cosmos.directory is down or returns unexpected data, the existing Tier 3 degradation should still work as before.

3. **The `verified` flag should remain `false`** for assets resolved via cosmos.directory. The static chain-registry package is the curated, trusted source. cosmos.directory is a convenience fallback.

4. **Cache TTL is 30 days** (2,592,000 seconds). This uses the existing `setInLocalStorage()` / `getFromLocalStorage()` utilities which already handle TTL-based expiry with the standard `{data, expiry}` JSON wrapper.

5. **Do not change the existing resolution tiers.** The static chain-registry data (Tier 1 and Tier 2 registry lookups) must continue to take priority. The cosmos.directory fetch is a NEW fallback tier that only fires when the static data has no match.

6. **The `counterpartyChainId` is already resolved** by the existing `counterpartyChainForChannel()` call at line 134. This on-chain query traverses channel -> connection -> client state to get the chain ID. You don't need to re-derive it.

7. **IBC deposit/withdraw enablement:** By populating `chainName` on `IBCData.counterparty` from cosmos.directory, the `canDepositFromIBC()` and `canSendToIBC()` checks in `src/utils/ibc.ts` will pass, enabling IBC transfers for the new chain. However, the app also needs the counterparty chain's RPC endpoint for signing IBC transfers — verify whether this is handled elsewhere or if additional work is needed.

8. **localStorage size:** The full cosmos.directory chains response may be several hundred KB. This should fit comfortably in localStorage (5MB+ typical budget), but if it's a concern, store only the fields you need: `{ chain_id, name, pretty_name, assets: [{ base, name, display, symbol, denom_units, logo_URIs }] }` for each chain.
