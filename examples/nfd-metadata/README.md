# NFD Metadata Example

This example demonstrates how to use the NFD SDK's metadata functionality to resolve avatar and banner images for NFDs.

## Features Demonstrated

- **Avatar Image Resolution**: Get avatar images with automatic fallback to default NFD avatar
- **Banner Image Resolution**: Get banner images (returns null if not set)
- **IPFS to HTTPS Conversion**: Automatic conversion of IPFS URLs to accessible HTTPS URLs
- **Verified vs User-Defined**: Shows verification status and ASA ID for NFT-based images
- **Optimization Paths**: Demonstrates both slow path (resolve then parse) and fast path (direct parsing)

## What You'll See

- Input field to enter any NFD name or app ID
- Real-time avatar and banner image display
- Metadata details including:
  - Raw on-chain values
  - Resolved HTTPS URLs
  - Verification status
  - ASA ID for verified NFT images
  - Whether avatar is using fallback default image

## Running the Example

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Visit `http://localhost:5173` in your browser to try the example.

## Try These NFDs

Some NFDs with interesting metadata to test:

- `nfdomains.algo` - User-defined avatar and banner
- `doug.algo` - Verified avatar and banner
- Any NFD name to see the avatar fallback in action

## About the NFD SDK

The NFD SDK provides various methods for interacting with Non-Fungible Domains on the Algorand blockchain. This example is part of a series of examples showcasing different features of the NFD SDK. Check out the other examples in this repository to learn more about the full capabilities of the SDK.
