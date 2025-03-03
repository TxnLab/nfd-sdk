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
