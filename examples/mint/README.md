# NFD SDK Mint Example

A React application demonstrating how to use the NFD SDK to mint new NFDs (Non-Fungible Domains) on TestNet.

## Features

- Connect to your Algorand wallet using @txnlab/use-wallet-react
- Get a price quote for minting an NFD
- Mint a new NFD with your connected wallet
- View detailed information about the minted NFD

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Visit `http://localhost:5173` in your browser to try the example.

## SDK Functions Demonstrated

This example demonstrates the following NFD SDK functions:

- `getMintQuote`: Get a price quote for minting an NFD
- `setSigner`: Set the transaction signer for the NFD client
- `mint`: Mint a new NFD on the Algorand blockchain

## Basic Code Example

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

// Create a client instance for TestNet
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

## About the NFD SDK

The NFD SDK provides various methods for interacting with Non-Fungible Domains on the Algorand blockchain. This example is part of a series of examples showcasing different features of the NFD SDK. Check out the other examples in this repository to learn more about the full capabilities of the SDK.
