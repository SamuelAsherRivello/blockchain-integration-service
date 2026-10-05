# Tasks

## 1. Define the new catalog

- [x] 1.1 Create the complete old-ID-to-new-ID mapping for every current A-H/X story, assigning each to Accounts, Payments/Transfers, Assets, Contracts, Transactions, Integrations, or X Appendix with Player Wallet, Game Wallet, shared, or neutral lane ownership; verify every current story has exactly one mapping.
- [x] 1.2 Define the canonical seven-domain and lane data used by documentation and Admin navigation; verify domain order, lane labels, and story ordering match the approved catalog.

## 2. Renumber documentation

- [x] 2.1 Rewrite `BIS/documentation/User Story Diagrams.md` with the new seven domain headings, P/G lanes, story IDs, table of contents, status table, and cross-reference; verify every heading and internal link resolves uniquely.
- [x] 2.2 Update diagram step labels, story references, and current-status wording without changing completion claims; verify partial, blocked, deferred, and live-pending stories retain their prior status.
- [x] 2.3 Preserve historical OpenSpec paths and evidence references while adding the old-ID-to-new-ID mapping; verify archived change links remain readable and no historical directory is renamed.

## 3. Align the Admin navigator

- [x] 3.1 Update Admin domain headings, story summaries, labels, and lane presentation to use the canonical catalog; verify Accounts, Payments/Transfers, Assets, Contracts, Transactions, Integrations, and X work are visibly distinct and Player Wallet/Game Wallet responsibilities are clear.
- [x] 3.2 Update story-selection routing and documentation links to use new IDs while preserving existing runtime account-selection identifiers and public APIs; verify Account, payment, asset, and game-wallet flows still open the same production surfaces.
- [x] 3.3 Keep implemented-only controls and existing disabled guards intact; verify planned, blocked, deferred, and live-pending stories do not become actionable merely because they were renumbered.

## 4. Update verification coverage

- [x] 4.1 Update Admin and documentation tests that assert old IDs, category order, labels, summaries, or anchors; verify the tests assert the new domain/lane catalog and compatibility mapping.
- [x] 4.2 Run the relevant Admin/documentation test suite, typecheck, and build; verify no old current-facing story IDs remain outside the explicit historical cross-reference and archived references.
- [x] 4.3 Perform a browser check of the Admin navigator and documentation route at the active base URL; verify domain order, P/G lane clarity, links, and implemented-control behavior match the proposal.
