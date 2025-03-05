# NFD SDK Resolve Example

A simple React application demonstrating how to use the NFD SDK to resolve NFD (Non-Fungible Domain) names and application IDs.

## Features

- Resolve NFDs by name (e.g., `doug.algo`) or application ID
- Select different view types (`tiny`, `brief`, or `full`) to optimize network requests by only fetching required box data
- View the NFD data in a formatted JSON output

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Visit `http://localhost:5173` in your browser to try the example.

## SDK Functions Demonstrated

This example demonstrates the use of the `resolve` method from the NFD SDK, which allows you to look up NFD data directly from the blockchain. The resolve function supports:

- Looking up by name (e.g., 'alice.algo')
- Looking up by application ID
- Different view types to optimize data retrieval

## Basic Code Example

```typescript
import { NfdClient } from '@txnlab/nfd-sdk'

// Create a client instance for TestNet
const nfd = NfdClient.testNet()

// Resolve an NFD by name with 'brief' view
const nfdData = await nfd.resolve('alice.algo', { view: 'brief' })

// Resolve an NFD by application ID
const nfdDataById = await nfd.resolve('123456789')
```

## About the NFD SDK

The NFD SDK provides various methods for interacting with Non-Fungible Domains on the Algorand blockchain. This example is part of a series of examples showcasing different features of the NFD SDK. Check out the other examples in this repository to learn more about the full capabilities of the SDK.
