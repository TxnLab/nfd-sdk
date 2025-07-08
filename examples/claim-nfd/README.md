# NFD Claim Example

This example demonstrates how to use the NFD SDK to claim NFDs that are reserved for your wallet address.

## Features

- Connect your wallet using the Wallet Connect protocol
- Search for NFDs reserved for your address using the NFD API
- Claim reserved NFDs using the NFD SDK's claiming API
- Simple and clean UI for managing the claiming process

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser to the provided localhost URL

## How it Works

1. **Connect Wallet**: Use the wallet connection interface to connect your Algorand wallet
2. **Search Reserved NFDs**: The app automatically searches for NFDs reserved for your connected address
3. **Claim NFDs**: Click the "Claim" button next to any reserved NFD to claim it to your wallet

## Code Example

Here's how simple it is to claim an NFD with the new API:

```typescript
// Simple claiming - just connect wallet and call claim()
const claimedNfd = await nfd
  .setSigner(address, transactionSigner)
  .claim('reserved-nfd.algo')
```

The NFD SDK automatically uses your connected wallet address as the claimer, making the API clean and intuitive.

## Important Notes

- This example runs on Algorand TestNet
- You need TestNet ALGO in your wallet to pay for transaction fees
- Reserved NFDs can be claimed for free (0 ALGO), but transaction fees still apply
- Make sure your wallet is connected to TestNet

## Technology Stack

- **React**: Frontend framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **@txnlab/nfd-sdk**: NFD SDK for blockchain interactions
- **@txnlab/use-wallet-react**: Wallet connection management
