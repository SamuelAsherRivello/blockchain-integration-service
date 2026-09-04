# Complete logout cleanup

Implemented the user's later, explicit logout-cleanup request. This does not claim that the broader browser-state proposal or an SDK intent-repository migration is complete.

- Existing backup acknowledgement remains mandatory.
- The additional checkbox is shown only for a positive locally persisted pending-operation count, with exact text `I accept losing my (5) pending transactions.` and the actual count.
- Count includes transfer, send, and mint recovery journals across saved wallets; legacy transfer/send duplicates are counted once. Unreadable records do not become zero.
- Confirmation binds to the pending operation set, not only its count. Core preflight and storage cleanup both recheck it.
- An exclusive browser-wide lock prevents cleanup from overlapping wallet mutations. Ordinary operations retain wallet-specific locks and use shared browser access.
- Cleanup erases all account object-store records (including identity, encryption key, and generation), known BIS local/session-storage journals, and demo preferences. It leaves an empty IndexedDB schema and unrelated storage intact. Current SDK repositories are all explicitly in-memory.
- Successful cleanup reloads the initiating app and broadcasts logout so other live app tabs discard their session state. It neither cancels nor resubmits network transactions.
- Preview scale and split layout no longer persist by default, preventing reload from recreating saved preferences.

## Verification

- `node --test packages/integration/tests/*.test.mjs`: 142 passing tests.
- `node --test packages/integration-demo/tests/split-layout.test.mjs`: 2 passing tests.
- `npm run build`: typecheck and both package builds pass; bundle-size warning remains.
- Playwright `/tests/logout-host.html?plain`: PASS with 0 pending; checkbox omitted.
- Playwright `/tests/logout-host.html?plain&pending=5`: PASS with exact label, both acknowledgement gates, cancellation/reopening, failure/retry, and logged-out destination.
- IndexedDB cleanup exercised through the production storage implementation with an in-memory database double. No real database records or live wallet data were deleted. Cross-context notification behavior has core coverage; real multi-tab destructive logout remains unexecuted.
