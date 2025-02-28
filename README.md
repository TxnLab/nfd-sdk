# NFDomains SDK

This monorepo contains the NFDomains SDK and related packages for interacting with the NFDomains (NFD) API and Algorand blockchain.

## Packages

- [@txnlab/nfd-sdk](./packages/sdk) - Core SDK package for NFDomains

## Development

This project uses PNPM workspaces. To get started:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes following our [commit message convention](./packages/sdk/CONTRIBUTING.md)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

MIT License
