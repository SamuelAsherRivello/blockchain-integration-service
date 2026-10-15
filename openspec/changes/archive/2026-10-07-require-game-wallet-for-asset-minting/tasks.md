## 1. Public capability APIs

- [x] 1.1 Add the provider-neutral public `hasItemSupport(): boolean` API and export its types without Arkade or secret-bearing values; verify Player Wallet active plus BIS item-path availability is the only positive condition.

## 2. Preserve separated item and reward flows

- [x] 2.1 Verify generic/admin item minting does not acquire a global Game Wallet gate and that existing wallet ownership semantics remain unchanged; run existing asset adapter/context tests.
- [x] 2.2 Verify trophy reward flow mints one item at a time and immediately transfers it to the Player Wallet, preserving operation-ID, ownership, pending, uncertain, and late-result recovery; add focused regression coverage.

## 3. Documentation and tests

- [x] 3.1 Add focused tests for `hasItemSupport()` with Player Wallet/no Game Wallet, no Player Wallet, unsupported environment, and Game Wallet changes; verify no Game Wallet setup or mutation is requested.
- [x] 3.2 Update package README/API migration notes with exact `hasItemSupport()` behavior, item/trophy ownership semantics, unchanged Game Wallet flows, and the fact that Stealth & Steel is unchanged.

## 4. Verification and release handoff

- [ ] 4.1 Run focused tests, package build, declaration/type checks, and relevant regressions; record results under `output/reports/require-game-wallet-for-asset-minting/`.
- [ ] 4.2 Pack the corrected BIS package under `output/releases/require-game-wallet-for-asset-minting/`, verify package version, SHA-256, and secret-free inventory.
- [ ] 4.3 Verify the tarball exposes `hasItemSupport()` in a clean consumer fixture and write the final handoff manifest with version, hash, test/build evidence, and downstream Stealth & Steel notes.
