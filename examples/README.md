# NFD SDK Examples

This directory contains example applications demonstrating various features of the NFD SDK.

## Available Examples

- [Resolve](./resolve/): Demonstrates how to resolve NFD names and application IDs
- [Lookup-only](./lookup/): Minimal Node script using the slim `@txnlab/nfd-sdk/lookup` entry for forward and on-chain reverse resolution
- [NFD Metadata](./nfd-metadata/): Demonstrates how to resolve avatar and banner images with IPFS support
- [API Search](./api-search/): Demonstrates how to use the API client to search for NFDs
- [Reverse Lookup](./reverse-lookup/): Demonstrates how to look up NFDs by wallet address
- [Mint](./mint/): Demonstrates how to mint NFDs
- [Claim NFD](./claim-nfd/): Demonstrates how to claim NFDs reserved for your wallet address
- [Link Address](./link-address/): Demonstrates how to link addresses to NFDs
- [Set Metadata](./set-metadata/): Demonstrates how to set metadata for NFDs
- [Set Primary NFD](./set-primary-nfd/): Demonstrates how to set a primary NFD for an address

## Getting Started

Each example is a standalone application with its own README.md file containing specific instructions.

In general, you can run any example by:

```bash
cd examples/<example-name>
pnpm install
pnpm dev
```
