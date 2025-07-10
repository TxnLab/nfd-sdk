# NFDomains SDK

SDK for interacting with NFDomains (NFD) API and Algorand blockchain. This package provides methods for domain resolution, record fetching, minting, and address linking operations.

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

```bash
# npm
npm install @txnlab/nfd-sdk

# yarn
yarn add @txnlab/nfd-sdk

# pnpm
pnpm add @txnlab/nfd-sdk
```

## Quick Start

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

// Create a client instance (MainNet by default)
const nfd = new NfdClient()

// Resolve an NFD by name
const nfdData = await nfd.resolve('alice.algo')
console.log(nfdData)
```

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

## License

MIT License
