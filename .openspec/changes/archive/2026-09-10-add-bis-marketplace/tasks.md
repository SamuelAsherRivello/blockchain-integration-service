## 1. Marketplace foundation

- [x] 1.1 Add the standalone `@bis/marketplace` React/TypeScript/Vite workspace and a minimal public Marketplace page; verify its production build succeeds and its Vite page loads without an account prompt.
- [x] 1.2 Add public catalog types and static-bundle input for game ID, registered game-wallet public address, nine item identities, artwork, tiers, and effect descriptions; verify a guest sees no private wallet material in the built page inputs.

## 2. Public catalog experience

- [x] 2.1 Render verified catalog entries as a stable 3 by 3 grid with public item-detail navigation and truthful disabled Buy/Sell controls; verify guest browsing causes no wallet or transaction action.
- [x] 2.2 Add anonymous read-only availability lookup for the registered public game-wallet address; verify unavailable or unreadable lookup results are not presented as stock or trade success.

## 3. Marketplace issuance

- [x] 3.1 Add H. Marketplace to the integration-demo Admin UI, gated on the active F. Game Wallet, and mint/reconcile the complete nine-item Stealth & Steel batch through the existing Signet asset boundary; verify a repeated or interrupted batch does not create a duplicate intended item.
- [x] 3.2 Publish only verified public catalog records into the Marketplace static input and verify the built Marketplace renders the issued asset identities and registered public address without recovery or signing data.

## 4. Verification

- [x] 4.1 Add focused automated coverage for catalog completeness, no-login behavior, truthful unavailable states, and batch reconciliation; verify the relevant workspace test suite passes.
- [x] 4.2 Build the root workspaces and smoke-test the Marketplace in a browser as an anonymous visitor; verify the nine-item grid and detail views are visible and Buy/Sell remain disabled.
