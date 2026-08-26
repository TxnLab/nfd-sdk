# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NFDomains SDK (`@txnlab/nfd-sdk`) — a TypeScript SDK for interacting with Non-Fungible Domains (NFDs) on the Algorand blockchain. Provides NFD resolution, minting, purchasing, and management via both on-chain smart contract calls and an HTTP API.

## Monorepo Structure

- **`packages/sdk/`** — the SDK package (published as `@txnlab/nfd-sdk`)
- **`examples/`** — React/Vite example apps demonstrating SDK features
- Package manager: **pnpm v10+** with workspaces (pinned by the root `packageManager` field, which CI reads too)
- Node version: **22.14.0** (see `.nvmrc`)

## Commands

All commands run from the repo root unless noted.

```bash
pnpm install              # Install dependencies
pnpm build                # Build the SDK (Vite → dist/esm + dist/cjs)
pnpm test                 # Run tests once (Vitest)
pnpm test:watch           # Run tests in watch mode
pnpm test:coverage        # Run tests with v8 coverage
pnpm lint                 # ESLint across all packages
pnpm format               # Prettier --write across all packages
pnpm typecheck            # TypeScript type checking (SDK only)
pnpm build:examples       # Build all example apps
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
- **NfdManager** (`modules/manager.ts`) — link addresses, set metadata, set primary NFD

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

`src/constants.ts` contains registry app IDs (`NfdRegistryId` enum: MAINNET=760937186, TESTNET=84366825) and API base URLs.

## Code Style

- **No semicolons**, single quotes, trailing commas (Prettier config in `.prettierrc`)
- **Import ordering** enforced by `eslint-plugin-import-x`: internal (`@/`) before external, alphabetical within groups, newlines between groups
- Path alias: `@/*` maps to `./src/*`
- Unused variables prefixed with `_` are allowed; other unused variables error

## Commit Conventions

Angular commit format: `type(scope): subject`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
Scopes: `core`, `api`, `contracts`, `metadata`, `purchasing`, etc.

`feat` → minor version bump, `fix` → patch, `BREAKING CHANGE` in footer → major (manual).

## CI

PR checks (`pr.yml`): lint → typecheck → test → build → build:examples. All must pass.
Publishing (`ci.yml`): automatic on push to main/alpha/beta/next branches via TanStack publish config.
