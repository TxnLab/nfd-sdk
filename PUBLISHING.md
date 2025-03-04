# Publishing @txnlab/nfd-sdk

This document outlines the process for publishing new versions of the `@txnlab/nfd-sdk` package.

## Automated Publishing via GitHub Actions

We use GitHub Actions to automate the publishing process. The workflow is triggered either:

1. Automatically when pushing to specific branches (`main`, `alpha`, `beta`, `next`)
2. Manually through the GitHub UI

### Publishing Process

#### Automatic Publishing

1. **Make your changes** and commit them with semantic commit messages:

   - `feat:` for new features (triggers a minor version bump)
   - `fix:` for bug fixes (triggers a patch version bump)
   - Include `BREAKING CHANGE:` in the commit body for breaking changes (requires manual version tag)

2. **Push to a publishing branch**:

   - `main` branch: Regular releases (latest tag)
   - `next` branch: Next releases (next tag)
   - `beta` branch: Beta releases (beta tag)
   - `alpha` branch: Alpha releases (alpha tag)

3. **The workflow will**:
   - Build and test the package
   - Determine the appropriate version bump based on commit messages
   - Update the package.json version
   - Publish to npm
   - Create a git tag
   - Create a GitHub release with a changelog

#### Manual Publishing

1. **Go to the "Actions" tab** in the GitHub repository
2. **Select the "Publish Package" workflow**
3. **Click "Run workflow"**
4. **Configure the workflow**:
   - Optionally provide a specific version tag (e.g., `v1.0.0`) for manual versioning
   - Optionally specify a branch to publish from (defaults to the current branch)
5. **Click "Run workflow"**

### Required Secrets

The following secrets must be configured in your GitHub repository:

- `NPM_TOKEN`: An npm access token with publish permissions for the @txnlab organization

## Version Bumping

The package version is determined by:

1. If a manual tag is provided (e.g., `v1.0.0`), that version will be used
2. Otherwise, the version is determined based on commit messages since the last tag:
   - `feat:` commits trigger a minor version bump
   - `fix:`, `refactor:`, `perf:` commits trigger a patch version bump
   - Commits with `BREAKING CHANGE:` in the body require a manual version tag

## First-time Publishing

For the first release, you need to provide a manual tag since there's no previous tag to compare against:

1. Go to the "Actions" tab in the GitHub repository
2. Select the "Publish Package" workflow
3. Click "Run workflow"
4. Enter `v0.1.0` (or your desired initial version) in the "Override release tag" field
5. Click "Run workflow"

## Prerelease Branches

- `main` branch: Regular releases (latest)
- `next` branch: Next releases (next)
- `beta` branch: Beta releases (beta)
- `alpha` branch: Alpha releases (alpha)
