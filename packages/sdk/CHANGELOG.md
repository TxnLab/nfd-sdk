# [2.0.0](https://github.com/TxnLab/nfd-sdk/compare/v1.1.0...v2.0.0) (2026-08-28)


### Features

* **sdk:** add NFD management, offers, verification, and suggestions ([c39edb7](https://github.com/TxnLab/nfd-sdk/commit/c39edb7fac91107b761669a37ea1d5e691ce0f68))


### Bug Fixes

* **core:** honor the instance contract's rules for vault and sale calls ([043e4c2](https://github.com/TxnLab/nfd-sdk/commit/043e4c2062e95012d3a4764df5291f1282699177))


### Documentation

* describe the actual semantic-release publishing flow ([1379a3e](https://github.com/TxnLab/nfd-sdk/commit/1379a3e3b06055912bdeae940999dab4aa6f57aa))


* feat(core)!: read NFD boxes in a single algod request ([f490cd2](https://github.com/TxnLab/nfd-sdk/commit/f490cd2820f4710434fb0e0ec83281b9c35283b5))


### BREAKING CHANGES

* footer.
- Squash-merging makes the PR title the commit header semantic-release reads,
  so a PR titled without a conventional type releases nothing.

Also records the plugins-only invocation for a local dry run, since the npm
and github plugins abort in verifyConditions without credentials.
* algosdk must now be v3.6.0 or later. The SDK reads NFD
properties with the include=values box query parameter, added in algosdk
v3.6.0; on an older algosdk, resolving an NFD fails at runtime rather
than at install time. It also needs an algod node new enough to honour
include=values, which the public MainNet and TestNet nodes already are.

# [1.1.0](https://github.com/TxnLab/nfd-sdk/compare/v1.0.0...v1.1.0) (2026-05-28)


### Features

* **lookup:** add @txnlab/nfd-sdk/lookup slim subpath export ([#20](https://github.com/TxnLab/nfd-sdk/issues/20)) ([873c6c3](https://github.com/TxnLab/nfd-sdk/commit/873c6c3355d4ef306868820198623b3fcda81b66))
