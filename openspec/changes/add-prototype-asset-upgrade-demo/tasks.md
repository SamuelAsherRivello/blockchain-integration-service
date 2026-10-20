# Tasks

## 1. Upgrade journal and Arkade operation flow

- [x] 1.1 Add a namespaced durable upgrade record model for network, source asset, quantity, target metadata, replacement asset, phase, and public transaction evidence; verify unit coverage rejects mismatched operation retries and excludes secret fields.
- [x] 1.2 Implement the same-wallet upgrade controller that loads the existing Mint Asset source, performs fresh ownership/funding checks, issues the level-two replacement, verifies it, and burns the exact source quantity; verify unit coverage for source validation, replacement-first ordering, and safe pre-submission failures.
- [x] 1.3 Add reconciliation for interrupted issuance or burn outcomes and completed-operation replay; verify tests prove no duplicate replacement or burn submission for the same operation identity.

## 2. Prototype Sandbox page and navigation

- [x] 2.1 Add the `Upgrade Asset` route after both asset-history entries and render its overview, inputs, action, output, and source display; verify route-contract and demo-coverage tests recognize the new page and label.
- [x] 2.2 Connect the page to the real network-backed upgrade controller using the existing mnemonic wallet and Mint Asset storage key without changing Mint Asset's no-send behavior; verify browser tests cover missing source, successful completion, and truthful failure output.
- [x] 2.3 Add the shared overview diagram and executable Arrange/Act/Assert source for the upgrade sequence, with no recovery phrase or fabricated transaction data; verify the source-format test passes.

## 3. Documentation and integration verification

- [x] 3.1 Document the demo as an immutable asset replacement rather than native reissuance, including the same-wallet scope and recovery limitations; verify the rendered page and documentation link use the active Vite base path.
- [x] 3.2 Run the Prototype Sandbox unit and browser coverage for navigation, output persistence, and upgrade recovery; verify all relevant tests pass without weakening existing asset-demo assertions.
- [x] 3.3 Run the repository's prescribed typecheck/build/test checks and record any live-network verification limitation without claiming success from fixtures alone.
