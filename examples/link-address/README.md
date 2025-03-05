# NFD SDK Link Address Example

A React application demonstrating how to use the NFD SDK to link and unlink Algorand addresses to an NFD.

## Features

- Connect to your Algorand wallet using @txnlab/use-wallet-react
- Look up an NFD by name
- View linked addresses
- Link a new address to an NFD (owner only)
- Unlink an address from an NFD (owner only)

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

- `NfdManager.linkAddress`: Link an Algorand address to an NFD
- `NfdManager.unlinkAddress`: Unlink an address from an NFD
- `NfdClient.manage`: Create a manager for a specific NFD
- `NfdClient.resolve`: Resolve an NFD to get its data
- `NfdClient.setSigner`: Set the transaction signer for the NFD client

## Basic Code Example

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

// Create a client instance for TestNet
const nfd = NfdClient.testNet()

// Link an address to an NFD
const updatedNfd = await nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')
  .linkAddress('ALGORAND_ADDRESS_TO_LINK')

// Unlink an address from an NFD
const updatedNfd2 = await nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')
  .unlinkAddress('ALGORAND_ADDRESS_TO_UNLINK')
```

## About the NFD SDK

The NFD SDK provides various methods for interacting with Non-Fungible Domains on the Algorand blockchain. This example is part of a series of examples showcasing different features of the NFD SDK. Check out the other examples in this repository to learn more about the full capabilities of the SDK.
