# Tasks

## 1. Metadata transport

- [x] 1.1 Encode structured custom metadata for Arkade issuance and decode JSON arrays after hex listing transport; verify all nine definitions and empty trophy deltas round-trip through real SDK metadata serialization and malformed values remain generic.
- [x] 1.2 Document the adapter boundary and confirmed regression in the change evidence; verify no gameplay fallback or recovery-journal reset is introduced.

## 2. Inventory lifecycle and errors

- [x] 2.1 Bound shared pending work, clean up timeout failures, suppress late caching, and map concurrent caller errors consistently; verify timeout, concurrent calls, and successful retry tests.
- [x] 2.2 Deduplicate Marketplace reads and remove status-driven refresh loops/automatic fallback reads; verify one failed attempt stays failed until explicit retry and scopes stay independent.
- [x] 2.3 Make Retry readable and functional, clear obsolete errors while retrying, and preserve Cancel without new loading; verify browser failure/retry/cancel flow and default allowCancel=false.

## 3. Networks and integration

- [x] 3.1 Audit Admin, Marketplace, adapter, and game network propagation; fix discovered mismatch/stale-scope paths and verify network-isolation tests.
- [x] 3.2 Run relevant tests, typecheck, and builds; verify browser Admin and Marketplace routes and record public evidence under output.

## 4. Funded acceptance

- [x] 4.1 Verify selected matching-network wallets, spendable funds, recovery records, and current holdings through Admin before mutation; record public identity/network only.
- [x] 4.2 Mint missing catalog items through Admin and freshly list all nine successfully; reconcile uncertain operations with their original IDs and record public chain evidence.
- [x] 4.3 Verify Game Wallet and Player Wallet listings in Marketplace, purchase one item, and verify fresh Player ownership with real transaction evidence.
- [x] 4.4 Consume the repaired BIS integration in the separate game and verify equipping/using the purchased item affects gameplay through chain-provided deltas; record browser evidence.
