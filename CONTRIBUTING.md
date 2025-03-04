# Contributing

Thank you for considering contributing to `@txnlab/nfd-sdk`!

> **Note:** This SDK is in early development (pre-v1.0.0) and there are many features that are planned and soon to be added. In some cases, a feature you're considering proposing may already be in the works. Feel free to open an issue to discuss before investing significant time in implementation.

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
- Create a new branch from `main` using the following naming convention:

  - For features: `feature/my-awesome-feature`
  - For bug fixes: `fix/my-bug-fix`

- Install dependencies.

  ```bash
  pnpm install
  ```

  - We use pnpm v9 as our package manager. If you are not familiar with pnpm, please refer to the [pnpm documentation](https://pnpm.io/cli/install).

  - We use [nvm](https://github.com/nvm-sh/nvm) to manage node versions. Please make sure to use the version mentioned in the `.nvmrc` file.

  ```bash
  nvm use
  ```

- Build the SDK.

  ```bash
  pnpm build
  ```

- Implement your changes and tests to files in the `packages/sdk/src/` directory and corresponding test files.

- Git stage your changes and commit (see commit guidelines below).

- Submit PR for review (see PR guidelines below).

### Running Examples

- Make sure you have installed dependencies in the repository's root directory.

  ```bash
  pnpm install
  ```

- If you want to run an example against your local changes, navigate to the project in the `examples/` directory and run the following command:

  ```bash
  pnpm dev
  ```

## Git Commit Guidelines

`TxnLab/nfd-sdk` is using [Angular Commit Message Conventions](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines).

We have very precise rules over how our git commit messages can be formatted. This leads to **more readable messages** that are easy to follow when looking through the **project history**.

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

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation

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

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

### Revert

If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

## Pull Requests

- Pull requests will not be reviewed until all checks pass. Before submitting a pull request, ensure that you have run the following commands in the repository's root directory:

  ```bash
  pnpm lint
  ```

  ```bash
  pnpm format
  ```

  ```bash
  pnpm typecheck
  ```

  ```bash
  pnpm test
  ```

- If possible/appropriate, create new tests that fail without your changes and pass with them.

- Pull requests are merged by squashing all commits and editing the commit message if necessary using the GitHub user interface.

- Use an appropriate commit type. Be especially careful with breaking changes.

## Documentation

Documentation is available in the repository README and code comments. For documentation issues and feature requests, please [open an issue](https://github.com/txnlab/nfd-sdk/issues/new).

## Contact

If you have any questions, please join the NFDomains [Discord server](https://discord.gg/7XcuMTfeZP).

Thank you for contributing to `@txnlab/nfd-sdk`!
