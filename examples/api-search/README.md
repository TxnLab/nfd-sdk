# NFD SDK API Search Example

A simple React application demonstrating how to use the NFD SDK's API client to search for NFDs (Non-Fungible Domains) using various search parameters.

## Features

- Search for NFDs using a variety of parameters:
  - Substring (e.g., 'algo' to find 'algo.algo', 'algorithm.algo', etc.)
  - Owner address
  - Category (curated, premium, common)
  - State (reserved, forSale, owned, expired)
- Customize the number of results per page
- Paginate through search results
- View detailed NFD information including expandable JSON data

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Visit `http://localhost:5173` in your browser to try the example.

## SDK Functions Demonstrated

This example specifically demonstrates the `search` method from the NFD SDK's API client, which allows you to search for NFDs using various criteria. The API client does not require a wallet connection, making it ideal for read-only operations.

## About the NFD API Client

The `NfdApiClient` provides several methods for interacting with the NFD API:

- `search`: Search for NFDs using various criteria (demonstrated in this example)
- `resolve`: Resolve an NFD by name or application ID
- `reverseLookup`: Look up NFDs by wallet addresses (demonstrated in the reverse-lookup example)

This example is part of a series of examples showcasing different features of the NFD SDK. Check out the other examples in this repository to learn more about the full capabilities of the SDK.
