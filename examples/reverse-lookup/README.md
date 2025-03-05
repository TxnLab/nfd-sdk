# NFD SDK Reverse Lookup Example

A simple React application demonstrating how to use the NFD SDK's API client to perform reverse lookups, finding NFDs owned by specific wallet addresses.

## Features

- Look up NFDs by wallet address
- View all NFDs owned by a specific address
- Filter results by verification status
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

This example specifically demonstrates the `reverseLookup` method from the NFD SDK's API client, which allows you to find all NFDs owned by a specific wallet address. The API client does not require a wallet connection, making it ideal for read-only operations.

## About the NFD API Client

The `NfdApiClient` provides several methods for interacting with the NFD API:

- `search`: Search for NFDs using various criteria (demonstrated in the api-search example)
- `resolve`: Resolve an NFD by name or application ID
- `reverseLookup`: Look up NFDs by wallet addresses (demonstrated in this example)

This example is part of a series of examples showcasing different features of the NFD SDK. Check out the other examples in this repository to learn more about the full capabilities of the SDK.
