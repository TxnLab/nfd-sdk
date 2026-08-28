# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NFDomains SDK (`@txnlab/nfd-sdk`) — a TypeScript SDK for interacting with Non-Fungible Domains (NFDs) on the Algorand blockchain. Provides NFD resolution, minting, purchasing, and management via both on-chain smart contract calls and an HTTP API.

## Monorepo Structure

- **`packages/sdk/`** — the SDK package (published as `@txnlab/nfd-sdk`)
- **`examples/`** — React/Vite example apps demonstrating SDK features
- Package manager: **pnpm v10+** with workspaces (pinned by the root `packageManager` field, which CI reads too)
- Node version: **22.23.2** (see `.nvmrc`)

## Commands

All commands run from the repo root unless noted.

```bash
pnpm install              # Install dependencies
pnpm build                # Build the SDK (Vite → dist/esm + dist/cjs)
pnpm test                 # Run tests once (Vitest)
pnpm lint                 # ESLint across all packages
pnpm format               # Prettier --write across all packages
pnpm format:check         # Prettier --check from the root (what CI runs)
pnpm typecheck            # TypeScript type checking (SDK only)
pnpm build:examples       # Build all example apps
pnpm run ci               # The full PR sequence, in CI's order
```

Watch and coverage runs exist only in the SDK package, not at the root:

```bash
pnpm --filter @txnlab/nfd-sdk test:watch
pnpm --filter @txnlab/nfd-sdk test:coverage
```

Run a single test file:

```bash
pnpm --filter @txnlab/nfd-sdk exec vitest run tests/utils/nfd.test.ts
```

## Code Generation

The SDK has auto-generated code from two sources:

1. **OpenAPI client** (`src/api/*.gen.ts`) — generated from `src/api/openapi3.yaml` via `@hey-api/client-fetch`
2. **Algorand contract clients** (`src/contracts/NFD*Client.ts`) — generated from ARC-56 JSON specs in `src/contracts/minimal/`

Regenerate all: `pnpm --filter @txnlab/nfd-sdk generate`

**Do not hand-edit generated files.** The contract client files (`NFDInstanceClient.ts`, `NFDRegistryClient.ts`) are excluded from tsconfig compilation and are very large (~150KB each).

## Architecture

### Client & Module Pattern

`NfdClient` (`src/client.ts`) is the main entry point. It composes feature modules:

- **LookupModule** (`modules/lookup.ts`) — resolve NFD names/app IDs, reverse lookups, search
- **MetadataModule** (`modules/metadata.ts`) — avatar/banner image retrieval with IPFS conversion
- **MintingModule** (`modules/minting.ts`) — mint new NFDs with price quoting
- **PurchasingModule** (`modules/purchasing.ts`) — claim reserved NFDs, buy from marketplace
- **NfdManager** (`modules/manager.ts`) — link addresses, set metadata, set primary NFD, renew, list/cancel a sale, lock segments and the vault, send to and from the vault

All modules extend `BaseModule` (`modules/base.ts`), which provides access to the Algorand client, registry contract client, instance contract client, and signer management.

### Key Design Patterns

- **Fluent signer API**: `nfd.setSigner(addr, signer)` returns the client for chaining. The signer auto-resets after operations.
- **Network presets**: `NfdClient.mainNet()` / `NfdClient.testNet()` with correct registry app IDs and API URLs.
- **Dual output**: Build produces both ESM and CJS bundles. Contract clients are split into a separate `nfd-contracts` chunk.

### Reading boxes

An NFD's `userDefined` and `verified` properties live in application boxes, not global state. `getAllBoxes()` (`src/utils/internal/boxes.ts`) reads them **through the raw algod client** (`algorand.client.algod`) using `.include('values')`, so names and values arrive together — one request per page instead of one per box. Both readers share it: `LookupModule` via the `BaseModule.getAllBoxes()` wrapper, and the slim `NfdResolver` (`src/lookup-entry.ts`) directly. `buildNfdRecord()` then takes the boxes already carrying their values, which is why it is synchronous.

**Do not "simplify" this to `appClient.getBoxNames()` / `getBoxValues()`, and do not reintroduce a `getBoxValue` callback into `buildNfdRecord()`.** algokit-utils has no bulk box API at any version (checked through 9.2.0): its `AppManager.getBoxValues()` is `Promise.all(boxNames.map(getBoxValue))`, i.e. still one HTTP request per box. Going back to it silently restores an N+1 — a property-rich NFD costs 15 round-trips instead of 1.

Consequences to keep in mind:

- **algosdk >= 3.6.0 is required** — `.include()` does not exist before it. This is why `peerDependencies.algosdk` is `^3.6.0`; loosening it breaks consumers at runtime, not at install.
- `getAllBoxes()` follows `nextToken` and pins later pages to the first page's `round`. It throws if the cursor repeats (a node that never advances would loop forever) or if a box comes back without a value (a node ignoring `include=values`, which would otherwise yield an NFD silently missing all properties).
- `resolve()`'s `view` option selects which boxes are **parsed**, not which are fetched — all of them arrive in the one request regardless.
- Callers needing a raw box value should use `LookupModule.resolveWithBoxes()` and take it from the returned boxes rather than issuing a second read; `NfdManager` does this for `v.caAlgo.0.as`.

### API Client

`NfdApiClient` (`src/api-client.ts`) wraps the generated OpenAPI client for NFD HTTP API calls (resolve, search, reverse lookup). Configured per-network with MainNet/TestNet base URLs defined in `src/constants.ts`.

### Constants

`src/constants.ts` contains registry app IDs (`NfdRegistryId` enum: MAINNET=760937186, TESTNET=84366825), API base URLs, the Algorand zero address, the static fees contract calls are sent with (`APP_CALL_STATIC_FEE`, `RENEW_STATIC_FEE`, `VAULT_FEE_PER_ASSET`), and the vault's per-asset minimum balance (`VAULT_OPT_IN_MBR`). Put new fee figures here rather than inline — the same `3000n` appears in half a dozen methods and drifted apart once already.

Protocol limits are **not** constants: `maxYearsAllowed` and `segmentPlatformCostInUsd` come from `BaseModule.getConstraints()` at call time. A `MAX_RENEWAL_YEARS = 20` constant used to sit here and was wrong — the registry owns that number.

### The contract source

**Read the TealScript before writing or reviewing a method that wraps a contract call.** The ARC-56 JSON gives arg types and not a single `assert`, and every rule in the table below was shipped wrong because the JSON looked sufficient.

The contracts are a separate repo (`TxnLab/nfd-contracts`), not a dependency of this one. Set `$NFD_CONTRACTS` to your checkout — the two files that matter are:

```
$NFD_CONTRACTS/contracts/v3/contracts/
  NFDInstance.algo.ts    # per-NFD instance: vault, sale, locks, renew, fields
  NFDRegistry.algo.ts    # registry: mint, constraints, name/address boxes
```

If it is unset, find an existing checkout by the file rather than assuming a layout:

```bash
# macOS
NFD_CONTRACTS=$(mdfind 'kMDItemFSName == "NFDInstance.algo.ts"' | head -1)
# portable
NFD_CONTRACTS=$(find ~ -maxdepth 7 -type f -name NFDInstance.algo.ts \
  -not -path '*/node_modules/*' 2>/dev/null | head -1)
```

If neither turns anything up, the repo is not cloned — say so rather than guessing from the ABI.

Useful grep targets in `NFDInstance.algo.ts`: the private helpers at the bottom of the file — `mustBeCalledByOwner()`, `notForSaleOrExpired()`, `assertOwnerCalledNotForSaleOrExpired()`, `isForSale()`, `isExpired()` — tell you a method's preconditions in one line, since almost every public method opens with a call to one of them.

### Contract preconditions the SDK mirrors

| Contract method  | Asserts                                                                                                                                                                                                                  | Mirrored in                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `vaultOptIn`     | Not first in group; the transaction immediately before pays the vault `100_000 × assets.length`; `notForSaleOrExpired()`; owner only when the vault is locked                                                            | `sendToVault` builds `[MBR payment] → [vaultOptIn] → [optional transfer]` |
| `vaultSend`      | `assertOwnerCalledNotForSaleOrExpired()`; receiver ≠ zero address; `otherAssets` empty whenever `amount !== 0`; for ALGO (`asset === 0`) `amount > 0` and no other assets; the NFD's own ASA is clawed to the owner only | `sendFromVault`                                                           |
| `offerForSale`   | Owner; not expired; not minting; **`totalBoxes === 0`**                                                                                                                                                                  | `listForSale` (box count comes free from `getNfd()`)                      |
| `cancelSale`     | Owner; not expired; not minting; `isForSale()`                                                                                                                                                                           | `cancelSale`                                                              |
| `segmentLock`    | `assertOwnerCalledNotForSaleOrExpired()`; on unlock, `usdPrice >= segmentPlatformCostInUsd` (cents)                                                                                                                      | `lockSegment`                                                             |
| `vaultOptInLock` | `assertOwnerCalledNotForSaleOrExpired()`                                                                                                                                                                                 | `lockVault`                                                               |
| `renew`          | Payment ≥ one year's price; expiration capped by the registry's `maxYearsAllowed`; metadata must be cleared if someone other than the owner claims an expired NFD                                                        | `renew`                                                                   |
| `postOffer`      | Nothing — it only logs an ARC-28 event                                                                                                                                                                                   | `makeOffer` needs no precondition checks                                  |

The recurring shape: **listing an NFD for sale or letting it expire blocks nearly every owner-driven write** until it is cancelled or renewed. `NfdManager.assertNotForSaleOrExpired` and `assertNotMinting` exist to turn those into errors that name the cure.

Two more that bite when adding a method:

- **Check the ABI arg types against `src/contracts/minimal/*.arc56.json` before writing the JSDoc.** `vaultSend`'s `receiver` is an ABI `address`, not a string, so "accepts an NFD name" was a promise the code could not keep — a name has to be resolved to an address first (`NfdManager.resolveVaultReceiver`). A doc comment describing the NFD _API_'s behavior is not evidence of what the _contract_ accepts.
- **Coerce caller-supplied amounts with `toAmount()` (`src/utils/internal/numbers.ts`), never bare `BigInt()`.** `BigInt(1.5)` throws a `RangeError` that names neither the parameter nor the method; `toAmount(price, 'Sale price')` says which argument was wrong, and rejects negatives and unsafe integers as well.

Validate arguments and throw _before_ the `try` that wraps the send, so a bad argument is not reported as `Failed to …: <message>` as though the transaction had failed. Prefer checking a precondition the resolved `Nfd` already answers over letting an opaque `assert` failure come back from chain — `getNfd()` has the state and the boxes cached.

### What the tests can and cannot prove

`tests/modules/*.test.ts` mock the typed client and the composer wholesale. They verify **the SDK's own logic** — which guard fires, which args and fees a call is given, what order transactions are added in — and nothing about whether a node would accept the result. The `sendToVault` group was malformed for the contract's `groupIndex`/MBR asserts while its tests were green.

So:

- Assert on group **order** (`invocationCallOrder` on the group mock) wherever the contract cares about position. `TransactionComposer.build()` iterates `this.txns` in push order, so add-order is group order.
- A green suite is not evidence a call works on chain. Confirming that needs a `simulate()` against TestNet or a LocalNet run, which nothing in CI does today.
- When a change is driven by a contract `assert`, quote the assert in the test comment. The next reader cannot re-derive it from the ABI.

## Code Style

- **No semicolons**, single quotes, trailing commas (Prettier config in `.prettierrc`)
- **Import ordering** enforced by `eslint-plugin-import-x`: internal (`@/`) before external, alphabetical within groups, newlines between groups
- Path alias: `@/*` maps to `./src/*`
- Unused variables prefixed with `_` are allowed; other unused variables error

## Commit Conventions

Angular commit format: `type(scope): subject`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
Scopes: `core`, `api`, `contracts`, `metadata`, `purchasing`, etc.

`feat` → minor version bump, `fix` → patch, `BREAKING CHANGE` in footer → major.

Versions are computed by semantic-release from the commits since the last tag, so **do not hand-edit the `version` field** in `packages/sdk/package.json` — `@semantic-release/npm` overwrites it and `@semantic-release/git` commits the result.

## CI

PR checks (`ci.yml`): lint → format:check → typecheck → test → build → build:examples. All must pass. The same sequence is the root `ci` script, which `release` runs first.
Publishing (`release.yml`): on push to a release branch, semantic-release publishes to npm via OIDC trusted publishing (no `NPM_TOKEN`), cuts the GitHub release, and commits `chore(release): x.y.z [skip ci]`.
