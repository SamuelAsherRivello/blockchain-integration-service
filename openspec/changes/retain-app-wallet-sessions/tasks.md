# Tasks

## 1. Private app-session resource owner

- [x] 1.1 Add a private Arkade session factory with Player/Game slots, explicit in-memory repositories, `settlementConfig: false`, narrow read/sign borrowing, and an injectable SDK factory; verify fake-factory tests show zero wallets before eligibility, one Player wallet, and at most two role wallets with Game enabled.
- [x] 1.2 Implement shared bounded acquisition, failure reset, caller detachment, late-acquisition retirement, and single disposal ownership; verify tests for concurrent acquisition, cancelled first caller, creation failure followed by recovery, and disposal during initialization.
- [x] 1.3 Implement monotonic role generations and non-overlapping retirement/replacement, including bounded unavailable/quarantine state when cleanup is uncertain; verify A-to-B-to-A, network/operator replacement, and hung cleanup cannot publish stale results or create another signer.
- [x] 1.4 Document owner-versus-borrower lifetime and secret-handling constraints beside the private factory; verify exported package declarations contain no SDK wallet, provider, repository, or new secret-bearing session type.

## 2. App composition and account transitions

- [ ] 2.1 Wire the owner through `context-composition.ts`, `context-dependencies.ts`, core dependency seams, `BisService`, and Game Wallet composition while preserving standalone factories and injected tests; verify composed Player/Game consumers share one owner and independent app instances do not share wallets.
- [ ] 2.2 Replace Game refresh-on-every-context-publication with identity/network/relevant-evidence triggers and eligible in-flight joins; verify navigation/status-only publications cause no Game provider requests, while actual Game changes refresh once under existing policy.
- [ ] 2.3 Move creation/restoration SDK validation into serialized role-slot candidate handoff without changing encrypted account persistence; verify successful activation reuses the candidate and failed restore preserves the previous saved identity without overlapping wallets.
- [ ] 2.4 Connect logout, reset, network changes, cross-instance identity changes, and root disposal to retirement and publication guards; verify wallet-role, wallet-scope, network-selection, readiness-race, and game-wallet tests preserve existing access and guest-play behavior.
- [x] 2.5 Update the integration package's existing named README with the app-session ownership boundary and unchanged public API; verify relative links remain valid and the package README stays within the repository's approximate length target.
- [ ] 2.6 Preserve direct adapter entry points used by test-wallet inventory creation, live observations, funding receipts, and Swap verification through independent bounded Node lifetimes; verify focused test-wallet tests pass, standalone resources are disposed, and no browser-private signer or recovery material is exposed.

## 3. Fresh read boundary and balance reuse

- [ ] 3.1 Add attempt-scoped live evidence and complete-snapshot preparation on the retained role wallet using explicit contract synchronization; verify required indexer failure cannot return repository fallback as success, including successful `/v1/info` and overlapping watcher success cases.
- [ ] 3.2 Ensure required boarding, contract, network/policy, and amount-validation evidence is associated with the correct attempt; verify a failure followed by success recovers without reconstruction and an unrelated history failure does not poison balance.
- [ ] 3.3 Migrate balance, receive addresses, funding address acquisition, and operation availability reads away from temporary wallets; verify existing balance/address/funding suites plus repeated forced-live refresh tests show zero additional constructions or disposals.
- [ ] 3.4 Integrate compatible live snapshot sharing with the current read coordinator and indexer sharing without resetting deadlines or retry counts; verify refresh-after-invalidation, one-consumer cancellation, exhausted retry, and stale completion tests.
- [ ] 3.5 Document resource retention versus display cache versus authoritative live evidence at the freshness seam; verify tests retain current loading/cache policy and never use a cache hit to authorize a mutation.
- [ ] 3.6 Make complete authoritative ownership coverage explicit rather than relying on the SDK's default incremental cursor; verify missed older spends, inactive/recoverable contracts, and partial/paginated responses cannot yield a falsely complete successful snapshot.

## 4. Complete asset inventory and metadata

- [ ] 4.1 Migrate asset holdings/listing to retained role snapshots, preserving recoverable/unrolled coverage, terminal-spend exclusion, exact quantities, and public API isolation; verify asset-adapter and shared-inventory tests cover non-BIS assets, empty success, failed reads, and large quantities.
- [ ] 4.2 Add or reuse validated immutable metadata caching by network/operator/asset ID with bounded hydration outside the snapshot lane; verify changed live quantities reuse metadata, cross-network entries cannot leak, missing optional fields stay missing, and failed required lookups fail the complete listing.
- [ ] 4.3 Preserve metadata-roundtrip/provenance changes and current explicit retry behavior; verify metadata and readiness regressions plus replacement during hydration cannot restore obsolete rows or start an unbounded relisting loop.
- [ ] 4.4 Wire Admin and Marketplace authenticated inventory consumers to the app-owned role dependencies without adding a Game prerequisite to Player reads; verify public-address inventory remains provider-only and active two-role plus public-address browsing still creates at most two SDK wallets.
- [ ] 4.5 Document ownership versus immutable metadata freshness at the asset adapter/cache seam; verify the documentation describes actual tested cache keys and complete-list failure behavior.

## 5. Observation borrowers and reconciliation

- [ ] 5.1 Convert `activity.ts` and asset notifications from wallet owners into role borrowers and centralize shared event fan-out; verify opening/closing/reopening Assets and Transactions neither creates another SDK wallet nor duplicates network subscriptions.
- [ ] 5.2 Route onboarding inspection and Game observation through the shared role lifecycle while preserving subscription-gap closure, event invalidation, periodic reconciliation where already required, and deduplication; verify shared-wallet-observer, activity-stall, game-wallet-events, and onboarding-service regressions.
- [ ] 5.3 Separate full history preparation from balance/asset snapshot prerequisites and retain bounded reconnection; verify stalled history does not delay otherwise ready balance/assets and observer detach never disposes a wallet borrowed elsewhere.
- [ ] 5.4 Document which component owns subscriptions and disposal, including internal SDK observation versus external consumer callbacks; verify teardown tests prove all callbacks stop publishing on retirement and unchanged snapshots do not repeatedly restart pending reads.

## 6. Retained signing and transaction safeguards

- [ ] 6.1 Add scoped exclusive submission/interception leases which restore overridden wallet/provider methods in `finally` and order two-role locks deterministically; verify concurrent mutation/read tests detect no hook leakage, reservation bypass, deadlock, or duplicate input selection.
- [ ] 6.2 Migrate sending and boarding to the role signer without changing live preflight, fee/policy checks, reservations, consent, checkpoints, or receipt verification; verify send-adapter, sending, reservations, boarding lifecycle/worker/postcommit/recovery, and transfer-cancellation suites.
- [ ] 6.3 Migrate onboarding SDK factories and settlement helper borrowing to the retained role wallet without adopting no-op fallback locks/stores; verify onboarding-adapter/service and SDK cleanup tests preserve exact submitted/unknown/recoverable outcomes.
- [ ] 6.4 Migrate asset mint/burn/delivery and reconciliation to role leases, and align provider-only LTO identity/provider borrowing without constructing extra SDK wallets; verify asset mutation, contract/LTO, trophy reward, and payment suites keep exact authorization and journal semantics.
- [ ] 6.5 Separate ordinary retirement's reservation retention from deliberate local logout cleanup; verify pending transactions and checked/unchecked warnings do not require settlement before logout, old callbacks cannot restore cleared journals, and uncertain active SDK cleanup blocks overlapping replacement signing without blocking local logout.
- [ ] 6.6 Document retained-signer consent boundaries, automatic-settlement disabling, scoped-hook cleanup, and quarantine/recovery behavior beside the operation helper; verify acquisition, observation, and all read-only tests record zero transaction submissions.
- [ ] 6.7 Preserve committed selected-network transfer journals, record locks, exact receipt checks, and v2 reservation classification; verify both-network boarding/postcommit, logout-cleanup, and runner operation-accounting regressions without changing Admin Reset or joined-session guards.

## 7. Integration and performance acceptance

- [ ] 7.1 Audit production integration construction/disposal sites using `rg` for `Wallet.create`, `ReadonlyWallet.create`, and `withTemporaryWallet`; verify only the private owner constructs browser app-session SDK wallets and document every separate bounded standalone CLI verification, prototype, or test-fixture lifetime.
- [ ] 7.2 Add a cross-feature acceptance sequence spanning Player balance/assets, navigation, observer updates, optional Game activation, role replacement, and disposal; verify construction budget, generation isolation, current loading/cache policy, no extra Game/history prerequisite, and complete resource cleanup together.
- [ ] 7.3 Run `npm run typecheck`, `npm test`, and `npm run build` on the reconciled implementation; verify successful results or document reproducible unrelated baseline failures without altering unrelated work.
- [ ] 7.4 Collect secret-free matched prototype/BIS read-only timing evidence under `output/reports/retain-app-wallet-sessions/` using protected registered fixtures on Signet and Mutinynet where available, with at least ten warm forced-live samples per read, cold startup, metadata-cold/warm, cache hits, request counts, p50/p95, and provider phases; verify warm reads add zero wallet creations, pending-onboarding holds remain intact, and any missed target or unavailable network is reported honestly.
- [ ] 7.5 Deliver the acceptance summary mapping results to each `app-wallet-session` requirement, noting any unavailable live environment or separately authorized funded verification; verify no publishing, package import, storage clearing, or transaction submission was performed merely to collect read timing evidence.
