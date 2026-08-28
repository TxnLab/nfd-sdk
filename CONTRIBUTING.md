# Contributing

Thank you for considering contributing to `@txnlab/nfd-sdk`!

> **Note:** The SDK is under active development and there are features already planned or in progress. A feature you're considering proposing may already be in the works, so feel free to open an issue to discuss before investing significant time in implementation.

## Reporting Issues

If you have found an issue with `@txnlab/nfd-sdk`, please follow these steps:

- Provide a clear description of the issue, including the expected behavior and the actual behavior.
- Provide the version of `@txnlab/nfd-sdk` you are using and any other relevant context about your environment.
- Describe the exact steps which reproduce the problem in as much detail as possible.
- To help triage and fix the issue quickly, please provide a minimal reproducible example.

To create a shareable code example, you can use CodeSandbox (https://codesandbox.io/s/new) or Stackblitz (https://stackblitz.com/).

A public GitHub repository also works. 👌

Please ensure that the reproduction is as minimal as possible. For more information on how to create a minimal reproducible example, please refer to [this guide](https://stackoverflow.com/help/minimal-reproducible-example).

## Suggesting New Features

If you would like to suggest a new feature or enhancement for `@txnlab/nfd-sdk`, please follow these guidelines:

- Use a clear and descriptive title for the issue to identify the suggestion.
- Provide a step-by-step description of the suggested enhancement in as many details as possible.
- Provide specific examples to demonstrate the steps or point out the part of `@txnlab/nfd-sdk` where the enhancement could be implemented.

## Development

If you want to contribute to `@txnlab/nfd-sdk`, please follow these steps to get started:

- Fork the repository.
- Clone the repository.
- Create a new branch from `main`, named `<type>/<short-description>` using the same type as the commit will carry — `feat/vault-transfers`, `fix/reserved-for-address`, `ci/bump-actions`, `docs/publishing-flow`.

- Match your Node and pnpm versions to the repository.

  - We use [nvm](https://github.com/nvm-sh/nvm) to manage node versions. Use the version in `.nvmrc`:

    ```bash
    nvm use
    ```

  - pnpm is pinned by the root `packageManager` field, and Corepack will select it for you. If you are not familiar with pnpm, see the [pnpm documentation](https://pnpm.io/cli/install).

- Install dependencies.

  ```bash
  pnpm install
  ```

- Build the SDK.

  ```bash
  pnpm build
  ```

- Implement your changes and tests to files in the `packages/sdk/src/` directory and corresponding test files.

- Git stage your changes and commit (see commit guidelines below).

- Submit PR for review (see PR guidelines below).

### Generated code

Two sets of files under `packages/sdk/src/` are generated and must not be hand-edited — a regeneration will silently discard your changes:

- `src/api/*.gen.ts` — the OpenAPI client, generated from `src/api/openapi3.yaml`
- `src/contracts/NFD*Client.ts` — the Algorand contract clients, generated from the ARC-56 specs in `src/contracts/minimal/`

Regenerate both with `pnpm --filter @txnlab/nfd-sdk generate`. Edit the source of truth (the OpenAPI document or the ARC-56 spec) instead.

### Running tests

```bash
pnpm test                                        # run once, from the root
pnpm --filter @txnlab/nfd-sdk test:watch         # watch mode
pnpm --filter @txnlab/nfd-sdk test:coverage      # with v8 coverage
```

A single file:

```bash
pnpm --filter @txnlab/nfd-sdk exec vitest run tests/utils/nfd.test.ts
```

Only `test` exists at the root; the watch and coverage scripts live in the SDK package, hence the `--filter`.

Note that the module tests mock the typed contract client and the transaction composer wholesale. They verify the SDK's own logic — which guard fires, which arguments and fees a call is given, what order transactions are added in — and prove nothing about whether a node would accept the resulting group. When a change is driven by a contract `assert`, quote that assert in the test comment.

### Running Examples

- Make sure you have installed dependencies in the repository's root directory.

  ```bash
  pnpm install
  ```

- If you want to run an example against your local changes, build the SDK first (`pnpm build` from the root), then navigate to the project in the `examples/` directory and run the following command:

  ```bash
  pnpm dev
  ```

  The `lookup` example is a plain Node script rather than a Vite app; run it with `pnpm start`.

## Git Commit Guidelines

`TxnLab/nfd-sdk` is using [Angular Commit Message Conventions](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md).

We have very precise rules over how our git commit messages can be formatted. This leads to **more readable messages** that are easy to follow when looking through the **project history**.

These rules are not only cosmetic. Releases are automated by semantic-release, so the commit type determines the version bump and the commit subject and body become the published release notes. See [PUBLISHING.md](./PUBLISHING.md) for the full picture.

### Commit Message Format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special format that includes a **type**, a **scope** and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the **scope** of the header is optional.

Any line of the commit message cannot be longer than 100 characters! This allows the message to be easier to read on GitHub as well as in various git tools.

### Type

Must be one of the following. The right-hand column is the version bump the type produces:

| Type         | Meaning                                                                           | Bump  |
| ------------ | --------------------------------------------------------------------------------- | ----- |
| **feat**     | A new feature                                                                     | minor |
| **fix**      | A bug fix                                                                         | patch |
| **perf**     | A code change that improves performance                                           | patch |
| **refactor** | A code change that neither fixes a bug nor adds a feature                         | patch |
| **docs**     | Documentation only changes                                                        | none  |
| **style**    | Changes that do not affect the meaning of the code (white-space, formatting, etc) | none  |
| **test**     | Adding missing or correcting existing tests                                       | none  |
| **build**    | Changes to the build system or dependencies                                       | none  |
| **ci**       | Changes to the CI or release workflows                                            | none  |
| **chore**    | Other changes to auxiliary tools and libraries                                    | none  |

Only `feat`, `fix`, `perf` and `refactor` appear in the release notes. The rest are still part of the history; they just do not produce a release on their own.

### Scope

The scope could be anything specifying the place of the commit change. For example `core`, `api`, or `contracts`.

You can use `*` when the change affects more than a single scope.

### Subject

The subject contains a succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize first letter
- no dot (.) at the end

### Body

Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes". The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit closes.

**Breaking Changes** must start with the words `BREAKING CHANGE:` followed by a space or two newlines. The rest of the commit message is then used for this.

The `!` shorthand (`feat(core)!: …`) does **not** work on its own here, and it is worse than doing nothing. The Angular preset's header pattern does not allow the `!`, so such a header fails to parse as a `feat` at all — without the footer, the commit produces no version bump and never reaches the release notes. Write the footer; keep the `!` only as a marker for human readers:

```
feat(core)!: read NFD boxes in a single algod request

BREAKING CHANGE: algosdk must now be v3.6.0 or later.
```

### Revert

If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

## Pull Requests

- Pull requests will not be reviewed until all checks pass. Before submitting a pull request, run the whole CI sequence from the repository's root directory:

  ```bash
  pnpm run ci
  ```

  That is `lint`, `format:check`, `typecheck`, `test`, `build` and `build:examples`, in the order CI runs them. Run `pnpm format` first if `format:check` fails — both operate on the whole repository from the root.

- If possible/appropriate, create new tests that fail without your changes and pass with them.

- **The pull request title must be a valid commit header.** Pull requests are normally squash-merged, and the squash title defaults to the PR title, which becomes the commit header semantic-release parses. A PR titled `Add vault helpers` releases nothing; `feat(core): add vault helpers` releases a minor.

- Use an appropriate commit type, and be especially careful with breaking changes — see the footer rules above.

- If a pull request contains several commits that each deserve their own release-note entry, say so in the description and ask for a merge commit instead of a squash.

## Documentation

Documentation is available in the repository README and code comments. For documentation issues and feature requests, please [open an issue](https://github.com/txnlab/nfd-sdk/issues/new).

## Contact

If you have any questions, please join the NFDomains [Discord server](https://discord.gg/7XcuMTfeZP).

Thank you for contributing to `@txnlab/nfd-sdk`!
