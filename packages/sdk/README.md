# NFDomains SDK

SDK for interacting with NFDomains (NFD) API and Algorand blockchain. This package provides methods for domain resolution, record fetching, minting, and address linking operations.

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

### Renewing an NFD

```typescript
const manager = nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')

// Quote the renewal price per year, in microAlgos
const pricePerYear = await manager.getRenewalPrice()

// Renew for a whole number of years (default 1). The upper bound comes from
// the registry's maxYearsAllowed.
const renewed = await manager.renew(2)
```

### Listing an NFD for Sale

An NFD can only be sold once its properties are cleared — the contract refuses to
list one that still has user-defined or verified fields.

```typescript
const manager = nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')

// List for 100 ALGO, open to anyone
await manager.listForSale(100_000_000n)

// Or reserve the sale for one buyer
await manager.listForSale(100_000_000n, { reservedFor: 'BUYER_ADDRESS' })

// Take it off the market
await manager.cancelSale()
```

While an NFD is listed, the contract blocks the owner-driven writes that change
it — setting metadata, locking segments or the vault, and vault transfers. Call
`cancelSale()` before any of those. An expired NFD is blocked the same way until
it is renewed.

### Making an Offer

Offer to buy an NFD from its current owner. The owner is free to accept or ignore it.

```typescript
const result = await nfd
  .setSigner(activeAddress, transactionSigner)
  .makeOffer('example.algo', 50_000_000n, 'Would love to own this')
```

### Locking Segments and the Vault

```typescript
const manager = nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')

// Allow anyone to mint segments of this NFD at $3.00 (price is in USD cents).
// The price must be at least the registry's segmentPlatformCostInUsd.
await manager.lockSegment(false, 300)

// Stop segment minting entirely
await manager.lockSegment(true)

// Restrict vault opt-ins to the owner (unlocked lets anyone opt the vault in)
await manager.lockVault(true)
```

### Vault Operations

An NFD's vault holds assets on behalf of the NFD itself.

Opting the vault into an asset raises its minimum balance by 0.1 ALGO, and
`sendToVault` funds that in the same group. The contract charges it per asset
passed, whether or not the vault already holds that asset, so pass only assets it
still needs.

```typescript
const manager = nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')

// Opt the vault into assets without sending anything (costs 0.2 ALGO in MBR)
await manager.sendToVault([31566704, 312769], { optInOnly: true })

// Opt in and send in the same group. The amount applies to one asset, so call
// this once per asset to send several.
await manager.sendToVault([31566704], { amount: 1_000_000n, note: 'deposit' })

// ALGO (asset 0) needs no opt-in and owes no MBR, but can be sent the same way
await manager.sendToVault([0], { amount: 5_000_000n })

// Send one asset out of the vault by amount
await manager.sendFromVault([31566704], 'RECEIVER_ADDRESS', {
  amount: 500_000n,
})

// Omit the amount to send the full balance, closing the vault out of each
// asset listed. An amount cannot be combined with more than one asset.
await manager.sendFromVault([31566704, 312769], 'RECEIVER_ADDRESS')

// ALGO leaves the vault on its own, and always by amount
await manager.sendFromVault([0], 'RECEIVER_ADDRESS', { amount: 500_000n })

// The receiver can also be an NFD name, resolved to its deposit account…
await manager.sendFromVault([31566704], 'friend.algo', { amount: 500_000n })

// …or to that NFD's own vault
await manager.sendFromVault([31566704], 'friend.algo', {
  amount: 500_000n,
  receiverType: 'nfdVault',
})
```

### Verifying NFD Properties

Verification is a two-step exchange with the NFD API: request a challenge, satisfy it
out of band (a DNS record, a social post), then confirm.

```typescript
// Step 1 — request a challenge. The signer identifies the NFD owner.
const request = await nfd
  .setSigner(activeAddress, transactionSigner)
  .verifyRequest('example.algo', 'domain')

// Step 2 — confirm once the challenge has been satisfied
const result = await nfd.verifyConfirm(request.id, request.challenge)
```

Verifiable fields: `blueskydid`, `twitter`, `github`, `domain`, `email`, `avatar`, `banner`.

### Name Suggestions

```typescript
const suggestions = await nfd.suggest('patrick', {
  buyer: activeAddress,
  limit: 10,
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
