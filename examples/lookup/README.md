# NFD SDK Lookup-only Example

A minimal Node script demonstrating the slim [`@txnlab/nfd-sdk/lookup`](../../README.md#lookup-only-entry-txnlabnfd-sdklookup) entry point.

`NfdResolver` reads NFD records directly from on-chain state and does **not**
bundle the generated typed contract clients or the NFD HTTP API client, so it
ships in a fraction of the bytes of the full `NfdClient` (~13 KB vs. ~320 KB).
Reach for it in size-sensitive contexts — wallets, browser extensions, edge
functions — where you only need name/address resolution.

## Getting Started

```bash
# Install dependencies (from the repo root)
pnpm install

# Run the demo against MainNet (resolves nfdomains.algo by default)
pnpm --filter @txnlab/nfd-sdk-lookup-example start

# Or resolve a different name
pnpm --filter @txnlab/nfd-sdk-lookup-example start alice.algo
```

## SDK Functions Demonstrated

- `NfdResolver.mainNet()` — construct a resolver for MainNet (use
  `NfdResolver.testNet()` for TestNet)
- `resolve(name, { view })` — forward lookup: NFD name (or app ID) → full record
- `resolveAddress(address)` — reverse lookup: address → primary NFD (read
  on-chain via the registry's reverse index)

## Basic Code Example

```typescript
import { NfdResolver } from '@txnlab/nfd-sdk/lookup'

// MainNet by default; use NfdResolver.testNet() for TestNet
const resolver = new NfdResolver()

// Forward lookup: name (or app ID) → full NFD record
const nfd = await resolver.resolve('alice.algo')

// Reverse lookup: address → primary NFD (or null), read on-chain
const primary = await resolver.resolveAddress(nfd.owner)
```

> **Note:** Reverse lookups use the registry's on-chain reverse index, which
> only contains **verified** address links. If you need unverified matches or
> other API-only features, use the full `NfdClient`.

## About the NFD SDK

This example is part of a series showcasing the NFD SDK. Check out the other
examples in this repository to learn about the full capabilities of the SDK.
