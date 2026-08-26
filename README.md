# NFDomains SDK

This monorepo contains the NFDomains SDK for direct on-chain interaction with NFDomains (NFD) on the Algorand blockchain, as well as integration with the NFD API for some operations (e.g. batch lookups and searches). The repository also includes example projects demonstrating its usage.

## Versioning

This SDK is in early development (pre-1.0.0) and may introduce breaking changes despite our best efforts to avoid them. We recommend pinning the version in your package.json:

```json
{
  "dependencies": {
    "@txnlab/nfd-sdk": "0.1.2"
  }
}
```

Instead of using caret versioning:

```json
{
  "dependencies": {
    "@txnlab/nfd-sdk": "^0.1.2"
  }
}
```

Once we reach v1.0.0 with all planned features, breaking changes will only be introduced via major version bumps following semantic versioning.

## Installation

The SDK requires **`algosdk` v3.6.0 or later** as a peer dependency. Install both packages:

```bash
# npm
npm install @txnlab/nfd-sdk algosdk

# yarn
yarn add @txnlab/nfd-sdk algosdk

# pnpm
pnpm add @txnlab/nfd-sdk algosdk
```

> [!IMPORTANT]
> v3.6.0 is the minimum because the SDK reads an NFD's properties with the `include=values` box query parameter, added in algosdk v3.6.0. It reads every box in one request instead of one request per box.
>
> On an older algosdk this fails at runtime, not at install time. It also needs an algod node new enough to honour `include=values` — the public MainNet and TestNet nodes already do.

## Quick Start

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

// Create a client instance (MainNet by default)
const nfd = new NfdClient()

// Resolve an NFD by name
const nfdData = await nfd.resolve('alice.algo')
console.log(nfdData)
```

## Lookup-only entry (`@txnlab/nfd-sdk/lookup`)

If all you need is name/address resolution, import from the `@txnlab/nfd-sdk/lookup`
subpath instead of the full client. It exposes an `NfdResolver` that reads NFD
records directly from on-chain state and **does not bundle** the generated typed
contract clients or the NFD HTTP API client, so it ships in a fraction of the
bytes (roughly 13 KB vs. the full client's ~320 KB). Reach for it in
size-sensitive contexts — wallets, browser extensions, edge functions — where you
only need to resolve names and addresses and don't mint, purchase, or manage NFDs.

```typescript
import { NfdResolver } from '@txnlab/nfd-sdk/lookup'

// MainNet by default; use NfdResolver.testNet() for TestNet
const resolver = new NfdResolver()

// Forward lookup: name (or app ID) → full NFD record
const nfd = await resolver.resolve('alice.algo')

// Reverse lookup: address → primary NFD (or null), read on-chain
const primary = await resolver.resolveAddress(
  'ZZAF5ARA4MEC5PVDOP64JM5O5MQST63Q2KOY2FLYFLXXD3PFSNJJBYAFZM',
)

// Bulk reverse lookup: address → primary NFD
const records = await resolver.resolveAddresses([addr1, addr2])
```

You can pass your own `AlgorandClient` and/or a custom `registryId`:

```typescript
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { NfdResolver, NfdRegistryId } from '@txnlab/nfd-sdk/lookup'

const resolver = new NfdResolver({
  algorand: AlgorandClient.mainNet(),
  registryId: NfdRegistryId.MAINNET,
})
```

> **Note:** Reverse lookups use the registry's on-chain reverse index, which only
> contains **verified** address links. The `allowUnverified` option (from the full
> client's API-backed reverse lookup) therefore has no effect here. If you need
> unverified matches or other API-only features, use the full `NfdClient`.

## Usage Examples

### Resolving an NFD

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

// Create a client instance for TestNet
const nfd = NfdClient.testNet()

// Resolve an NFD by name with 'brief' view
const nfdData = await nfd.resolve('alice.algo', { view: 'brief' })

// Resolve an NFD by application ID
const nfdDataById = await nfd.resolve('123456789')
```

### Getting NFD Images (Avatar & Banner)

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

const nfd = NfdClient.testNet()

// Get avatar image with automatic fallback
const avatarResult = await nfd.getAvatarImage('alice.algo')
console.log(avatarResult.url) // Always returns a URL (fallback if needed)
console.log(avatarResult.verified) // true if from verified NFT properties
console.log(avatarResult.asaId) // ASA ID if verified image

// Get banner image (may be null)
const bannerResult = await nfd.getBannerImage('alice.algo')
console.log(bannerResult.url) // May be null if no banner set

// Fast path: If you already have NFD data
const nfdData = await nfd.resolve('alice.algo', { view: 'full' })
const avatar = await nfd.getAvatarImage(nfdData) // No additional resolve needed
const banner = await nfd.getBannerImage(nfdData) // No additional resolve needed
```

### Searching for NFDs

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

const nfd = NfdClient.testNet()

// Search for NFDs containing 'foo' in their name
const searchResults = await nfd.api.search({ substring: 'foo', limit: 10 })

// Search with multiple filters
const filteredResults = await nfd.api.search({
  category: ['premium'],
  state: ['owned'],
  limit: 20,
  offset: 0,
})
```

### Minting an NFD

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

const nfd = NfdClient.testNet()

// Get a price quote for minting an NFD
const quote = await nfd.getMintQuote('example.algo', {
  buyer: 'ALGORAND_ADDRESS',
  years: 5,
})

// Mint the NFD using the quote
const mintedNfd = await nfd
  .setSigner(activeAddress, transactionSigner)
  .mint(quote.nfdName, {
    buyer: quote.buyer,
    years: quote.years,
  })
```

### Purchasing NFDs (Claiming & Buying)

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

const nfd = NfdClient.testNet()

// Get a purchase quote to check eligibility and pricing
const quote = await nfd
  .setSigner(activeAddress, transactionSigner)
  .getPurchaseQuote('reserved-nfd.algo')

if (quote.canClaim) {
  // Claim a reserved NFD (automatically uses signer's address)
  const claimedNfd = await nfd
    .setSigner(activeAddress, transactionSigner)
    .claim('reserved-nfd.algo')

  console.log('Successfully claimed:', claimedNfd.name)
}

if (quote.canBuy) {
  // Buy an NFD from the secondary market
  const purchasedNfd = await nfd
    .setSigner(activeAddress, transactionSigner)
    .buy('forsale-nfd.algo')

  console.log('Successfully purchased:', purchasedNfd.name)
}
```

### Managing an NFD

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

const nfd = NfdClient.testNet()

// Link an address to an NFD
const updatedNfd = await nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')
  .linkAddress('ALGORAND_ADDRESS_TO_LINK')

// Set metadata for an NFD
const updatedNfd2 = await nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')
  .setMetadata({
    website: 'https://example.com',
    twitter: '@example',
  })
```

## Client Initialization Options

The NFD client can be instantiated in several ways:

```typescript
// Default constructor (MainNet)
const nfd = new NfdClient()

// Using static methods
const mainNetNfd = NfdClient.mainNet() // define MainNet explicitly
const testNetNfd = NfdClient.testNet() // define TestNet explicitly

// Using custom AlgorandClient and explicit NFD registry ID
import { NfdClient, NfdRegistryId } from '@txnlab/nfd-sdk'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

const algorand = AlgorandClient.mainNet()
const customNfd = new NfdClient({
  algorand,
  registryId: NfdRegistryId.MAINNET,
})
```

## Examples

Check out the [examples directory](./examples) for complete working examples of various SDK features:

- [Resolve](./examples/resolve/): Demonstrates how to resolve NFD names and application IDs
- [NFD Metadata](./examples/nfd-metadata/): Demonstrates how to resolve avatar and banner images with IPFS support
- [API Search](./examples/api-search/): Demonstrates how to use the API client to search for NFDs
- [Reverse Lookup](./examples/reverse-lookup/): Demonstrates how to look up NFDs by wallet address
- [Mint](./examples/mint/): Demonstrates how to mint NFDs
- [Link Address](./examples/link-address/): Demonstrates how to link addresses to NFDs
- [Set Metadata](./examples/set-metadata/): Demonstrates how to set metadata for NFDs

## Package

- [@txnlab/nfd-sdk](./packages/sdk) - Core SDK package for NFDomains

## Development

This project uses PNPM workspaces. To get started:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

## Contributing

Please see our [Contributing Guidelines](./CONTRIBUTING.md) for more details on how to get involved.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes following our [commit message guidelines](./CONTRIBUTING.md#git-commit-guidelines)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

MIT License
