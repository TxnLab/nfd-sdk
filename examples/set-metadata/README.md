# NFD SDK Set Metadata Example

A React application demonstrating how to use the NFD SDK to set and manage user-defined metadata for an NFD.

## Features

- Connect to your Algorand wallet using @txnlab/use-wallet-react
- Look up an NFD by name
- View user-defined metadata
- Add or update metadata (owner only)
- Delete metadata (owner only)
- Support for adding multiple metadata fields in a single transaction

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

- `NfdManager.setMetadata`: Add, update, or delete user-defined metadata
- `NfdClient.manage`: Create a manager for a specific NFD
- `NfdClient.resolve`: Resolve an NFD to get its data
- `NfdClient.setSigner`: Set the transaction signer for the NFD client

## Basic Code Example

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

// Create a client instance for TestNet
const nfd = NfdClient.testNet()

// Add or update metadata for an NFD
const updatedNfd = await nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')
  .setMetadata({
    website: 'https://example.com',
    github: 'example',
  })

// Delete a metadata field by setting its value to an empty string
const updatedNfd2 = await nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')
  .setMetadata({ github: '' })
```

## Metadata Format

The metadata is stored as key-value pairs. To delete a metadata entry, set its value to an empty string.

## About the NFD SDK

The NFD SDK provides various methods for interacting with Non-Fungible Domains on the Algorand blockchain. This example is part of a series of examples showcasing different features of the NFD SDK. Check out the other examples in this repository to learn more about the full capabilities of the SDK.
