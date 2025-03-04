# NFDomains SDK

This monorepo contains the NFDomains SDK for direct on-chain interaction with NFDomains (NFD) on the Algorand blockchain, as well as integration with the NFD API for some operations (e.g. batch lookups and searches). The repository also includes example projects demonstrating its usage.

## Package

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

Please see our [Contributing Guidelines](./CONTRIBUTING.md) for more details on how to get involved.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes following our [commit message guidelines](./CONTRIBUTING.md#git-commit-guidelines)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

MIT License
