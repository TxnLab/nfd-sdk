# Publishing @txnlab/nfd-sdk

Releases are fully automated by [semantic-release](https://semantic-release.gitbook.io/). **Merging to `main` is the release.** There is no manual publish step, no version to bump by hand, and no release notes to write.

## The pipeline

`.github/workflows/release.yml` runs on every push to `main` (and only in the `TxnLab/nfd-sdk` repository, so forks never publish):

1. Mint a token from the release GitHub App.
2. Check out the full history — semantic-release needs the tags to work out the last release.
3. Install dependencies with the pnpm version pinned by the root `packageManager` field, on the Node version in `.nvmrc`.
4. `pnpm run ci` — lint, format:check, typecheck, test, build, build:examples. The same sequence PRs run.
5. `npm audit signatures` — verify the registry signatures of installed dependencies.
6. `npx semantic-release`.

If any step fails, nothing is published.

## What semantic-release does

Configured in `.releaserc.js`, releasing from `main` only, tagged `v${version}`, with `pkgRoot` pointing at `packages/sdk`:

| Plugin                    | Effect                                                                           |
| ------------------------- | -------------------------------------------------------------------------------- |
| `commit-analyzer`         | Reads the commits since the last tag and decides the bump                        |
| `release-notes-generator` | Renders the notes from those commits                                             |
| `changelog`               | Prepends them to `packages/sdk/CHANGELOG.md`                                     |
| `npm`                     | Writes the version into `packages/sdk/package.json` and publishes to npm         |
| `github`                  | Creates the `vX.Y.Z` tag and the GitHub Release                                  |
| `git`                     | Commits the changelog and package.json back as `chore(release): x.y.z [skip ci]` |

**Do not hand-edit the `version` field in `packages/sdk/package.json`.** `@semantic-release/npm` overwrites it and `@semantic-release/git` commits the result, so a hand-set version is either ignored or fights the tool.

## Version bumps

The bump comes from the commit types since the last tag, following the [Angular convention](./CONTRIBUTING.md#git-commit-guidelines):

| Commit                                      | Bump  |
| ------------------------------------------- | ----- |
| `feat:`                                     | minor |
| `fix:`, `perf:`, `refactor:`                | patch |
| `BREAKING CHANGE:` in the footer            | major |
| `docs:`, `style:`, `test:`, `chore:`, `ci:` | none  |

A push containing only no-bump types publishes nothing — the workflow succeeds and semantic-release logs that there is no release to make.

### A major needs the `BREAKING CHANGE:` footer

The `!` shorthand does **not** work on its own here, and it is worse than a no-op. The Angular preset's header pattern is `/^(\w*)(?:\((.*)\))?: (.*)$/` — it has no `breakingHeaderPattern` — so `feat(core)!: …` fails to parse as a `feat` at all. Without a footer, such a commit contributes no bump and never reaches the Features section.

Write the footer, and keep the `!` only as a visual marker:

```
feat(core)!: read NFD boxes in a single algod request

BREAKING CHANGE: algosdk must now be v3.6.0 or later.
```

## Release notes

`release-notes-generator` is configured to show only the sections that matter to consumers: **Features**, **Bug Fixes**, **Code Refactoring** and **Performance Improvements**. `docs`, `style`, `chore`, `test`, `build` and `ci` commits are hidden — they still count toward the history, they just do not appear in the notes. Breaking changes get their own section regardless of type.

This means the commit subject and body **are** the release notes. Write them for someone reading the GitHub Release, not for the diff.

## Merging: mind the squash title

Pull requests are squash-merged, and the squash title defaults to the PR title. That title becomes the commit header semantic-release parses, so **the PR title must carry the right type** — a PR titled `Add vault helpers` yields no release at all, where `feat(core): add vault helpers` yields a minor.

The squash body is the concatenated commit messages, so a `BREAKING CHANGE:` footer written in a branch commit does survive the squash. Still, for a release that spans several meaningful commits — a major especially — prefer a merge commit so each subject reaches the notes intact instead of collapsing into one entry.

## Authentication

Nothing in the release path uses a long-lived npm token.

- **npm** — publishing uses [OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers). The npm package is configured to trust `TxnLab/nfd-sdk`'s `release.yml`, which is why the job needs `id-token: write`. `publishConfig.provenance` is `true`, so every release carries a provenance attestation. There is no `NPM_TOKEN` secret and adding one is not the fix for a publish failure.
- **GitHub** — the tag, release and release commit are made with a token minted from a GitHub App, so the release commit is attributable and can pass branch protection. It needs the `RELEASE_BOT_APP_ID` repository variable and the `RELEASE_BOT_PRIVATE_KEY` secret.

## Checking what a release would do

From a branch, before merging:

```bash
nvm use   # semantic-release requires the Node version in .nvmrc

npx semantic-release --dry-run --no-ci \
  --branches "$(git branch --show-current)" \
  --plugins @semantic-release/commit-analyzer @semantic-release/release-notes-generator
```

Overriding `--plugins` restricts the run to analysis and note rendering, which is what makes it work locally — the npm and github plugins verify credentials during `verifyConditions` and abort without them. The output prints the computed next version and the notes as they will appear.

## Troubleshooting

**Nothing was published.** Check the release job log for `no relevant changes`. Every commit since the last tag was a non-bumping type — most often a PR squash-merged under a title with no conventional-commit type.

**The bump was wrong.** semantic-release reads what was committed, not what was intended. Once a tag is published it stays; correct it by landing a follow-up commit with the right type rather than by moving the tag or unpublishing.

**`npm ERR! 404` or an auth error during publish.** The trusted publisher configuration on npmjs.com no longer matches the workflow — check the repository, workflow filename and environment recorded there against `release.yml`.

**A `node version ... is required` error.** semantic-release supports a narrow Node range; the workflow pins it from `.nvmrc`. Locally, run `nvm use` first.
