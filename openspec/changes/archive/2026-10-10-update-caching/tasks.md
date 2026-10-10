# Tasks

## 1. Shared cache and invalidation model

- [x] 1.1 Define the provider-neutral cache entry types, five-minute default freshness policy, account/network/data-type scope, complete-result validation, and stale-entry behavior; verify the typecheck and focused cache unit tests cover fresh, expired, failed, partial, and cross-account results.
- [x] 1.2 Add dependency-aware invalidation signals for account lifecycle, network changes, logout/reset/disposal, explicit refresh, wallet-operation initiation, provider observations, and cross-context storage changes; verify focused tests show direct dependents are invalidated while unrelated data remains reusable.
- [x] 1.3 Verify every data-backed runtime view declares automatic, modal, and cache policy, including Account Details, Onboarding, Recovery Phrase, and Marketplace bootstrap exceptions.

## 2. Balance, Send, and Swap consumers

- [x] 2.1 Route balance reads from Account Details, Receive, Send, and Swap through the shared balance snapshot; verify Send entry requires only the Arkade balance read and reuses a fresh balance loaded by another view.
- [x] 2.2 Keep Send and Swap review/quote/submission boundaries live and authoritative after cached entry rendering; verify cached balances never authorize stale send or transfer inputs and explicit refresh bypasses the cache.
- [x] 2.3 Add balance invalidation for sends, receives, swaps/transfers, incoming wallet evidence, account replacement, and network changes; verify the next affected view read is fresh while an unrelated cached view remains available.
- [x] 2.4 Cache the complete Account Details balance-and-address snapshot and reuse it on fresh same-account re-entry; preserve non-modal placeholders and make explicit Refresh bypass it.

## 3. Receive, Assets, Contracts, and Transactions consumers

- [x] 3.1 Cache complete Receive address results and reuse them for five minutes across view remounts; verify logout, account/network replacement, and address-affecting wallet changes invalidate them.
- [x] 3.2 Cache complete Assets and Contracts results with separate data types and declared dependencies; verify returning within five minutes avoids a provider read and mint/burn/delivery or contract events invalidate the relevant snapshot.
- [x] 3.3 Cache complete Transactions/activity results and preserve existing local operation reconciliation; verify incoming/outgoing wallet observations and send/receive/swap/transfer outcomes invalidate transaction data without invalidating unrelated addresses.

## 4. View loading and presentation integration

- [x] 4.1 Replace per-view initial loading timing with the shared construction-gated entry policy for Receive, Send, Swap, Assets, Contracts, Transactions, and Recovery Phrase; verify reads begin immediately, modal entries show their normal construction-gated presentation for fresh or cached data, and slow reads remain covered after first frame.
- [x] 4.2 Preserve immediate loading for explicit refreshes and foreground mutations, non-modal Account Details, nonblocking Onboarding, and Marketplace bootstrap; verify shared Pending Operation Dialog accessibility and abort behavior remain intact.
- [x] 4.3 Standardize Refresh affordances so active reads disable and mute the icon, spin it unless reduced motion is requested, and stop animation on every terminal or cancellation path.
- [x] 4.4 Verify Account Details renders dash placeholders and remains interactive during automatic and explicit balance reads without opening the Pending Operation Dialog.
- [x] 4.5 Make modal-policy cache hits use the same brief construction-gated loading presentation as uncached entries, with no provider-read or arbitrary-timer delay; keep Account Details cache hits non-modal.

## 5. Verification and documentation

- [x] 5.1 Add browser and state-layer regression coverage for cache reuse, TTL expiry, identity/network isolation, invalidation events, late results, and cross-view reuse; verify the focused suites and `npm run typecheck` pass.
- [x] 5.2 Update the integration and package README documentation with cacheable data, invalidation events, consumer rules, and live revalidation boundaries; verify all documented commands and links remain valid.
- [x] 5.3 Run the complete project test/build verification and record any environment-only limitations in the change artifacts; verify Admin, Marketplace, and all affected Account destinations still build successfully.
- [x] 5.4 Reconcile the stopped `codify-view-loading-and-cache` acceptance cases into focused tests, including complete-result exclusion, late-result guards, refresh animation, policy declarations, and Account Details usability.
- [x] 5.5 Add regression coverage proving cached Assets, Contracts, Transactions, and Receive entries show the normal modal presentation before revealing cached data, while explicit refresh remains immediate.
- [x] 5.6 Add Account Details regression coverage for combined snapshot reuse, no spinner on cached re-entry, explicit-refresh bypass, partial-result exclusion, and account/network isolation.
