# NFDomains SDK

This monorepo contains the NFDomains SDK for direct on-chain interaction with NFDomains (NFD) on the Algorand blockchain, as well as integration with the NFD API for some operations (e.g. batch lookups and searches). The repository also includes example projects demonstrating its usage.

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
const quote = await nfd.getMintQuote('example.algo', 5)

// Mint the NFD using the quote
const mintedNfd = await nfd
  .setSigner(activeAddress, transactionSigner)
  .mint(quote.nfdName, {
    buyer: quote.buyer,
    years: quote.years,
  })
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
