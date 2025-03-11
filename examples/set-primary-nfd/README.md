# NFD SDK Set Primary NFD Example

A React application demonstrating how to use the NFD SDK to set a primary NFD for an Algorand address when the address owns multiple NFDs.

## Features

- Connect to your Algorand wallet using @txnlab/use-wallet-react
- View NFDs owned by your connected address
- Show the current primary NFD for your address
- Set any owned NFD as your primary NFD
- Optimistic UI updates with API sync handling

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

- `NfdClient.searchByOwner`: Retrieves all NFDs owned by a specific address
- `NfdClient.resolveAddress`: Gets the primary NFD for a specific address
- `NfdManager.setPrimaryNfd`: Sets a specific NFD as the primary NFD for an address
- `NfdClient.setSigner`: Set the transaction signer for the NFD client

## Basic Code Example

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

// Create a client instance for TestNet
const nfd = NfdClient.testNet()

// Set an NFD as primary for an address
const updatedNfd = await nfd
  .setSigner(activeAddress, transactionSigner)
  .manage('example.algo')
  .setPrimaryNfd(activeAddress)

// Get the primary NFD for an address
const primaryNfd = await nfd.resolveAddress(activeAddress)
```

## Implementation Details

This example includes additional features to handle the delay between a successful blockchain transaction and when the API reflects the updated state:

1. Chain-style API calls for fluent method chaining
2. Optimistic UI updates for immediate feedback
3. API sync handling with a custom `useApiSync` hook that:
   - Periodically checks if the API has updated
   - Provides loading state indicators
   - Handles success/failure cases

For the complete implementation including API sync handling, see the source code in `src/App.tsx`.

## About the NFD SDK

The NFD SDK provides various methods for interacting with Non-Fungible Domains on the Algorand blockchain. This example is part of a series of examples showcasing different features of the NFD SDK. Check out the other examples in this repository to learn more about the full capabilities of the SDK.
