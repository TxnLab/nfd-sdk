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

This example demonstrates the use of the `resolve` method from the NFD SDK, which allows you to look up NFD data directly from the blockchain.
