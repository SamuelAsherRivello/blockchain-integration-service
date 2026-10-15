# Design

## Context

See [proposal.md](proposal.md) for motivation and the current/proposed pros and cons. Relevant observed implementation facts:

- `wallet-layer-arkade/account.ts` owns `withTemporaryWallet`; balance, addresses, assets, sending, funding, and boarding construct SDK wallets around individual calls. `activity.ts` constructs and disposes its own observation wallet. Onboarding has separate readonly/signing factories.
- `balance.ts` adds a live network preflight and a per-call indexer failure latch because SDK reads can fall back to repository data. Moving that latch unchanged onto a retained provider would permanently poison the session or incorrectly mix concurrent failures.
- Asset and onboarding adapters intercept wallet/provider methods for input filtering, submission evidence, and checkpoints. Those interceptions are safe only while operation-scoped; a retained wallet makes leaked hooks dangerous.
- `BisService` currently calls Game Wallet refresh on every context publication. Reusing a wallet alone does not remove that fan-out.
- `shared-wallet-service.ts` is an externally supplied settlement helper, not a session owner. Its aggregate read includes history, and its fallback lock/store are not substitutes for BIS's real transaction safeguards.
- `indexer-reads.ts` already deduplicates concurrent identical indexer calls. Keep compatible in-flight sharing, but do not mistake it for completed-data freshness or session ownership.
- The test-wallet foundation is committed at `864badf2`. `BIS/scripts/test-wallets/observations.mjs`, `inventory.mjs`, and `funding.mjs` call production adapters directly; `swap.mjs` uses a separate read-only verification wallet. Preserve those seams and their durable operation IDs, selected-network transfer journals, and v2 reservation classification.

Pre-apply review of the working checkout passed `npm run typecheck` and 40 focused balance, Game Wallet, and logout-cleanup tests. This is not proof that the commit alone, the full suite, or live transaction acceptance passes; parallel changes remain in the checkout.

### SDK and documentation evidence

Installed `@arkade-os/sdk` is 0.4.72. Its declarations and bundled implementation expose `Wallet.create`, `getContractManager`, `refreshVtxos`, `getBalance`, `getVtxos`, notifications, and disposal. Contract-manager initialization is memoized within an SDK wallet. `getContractsWithVtxos` can catch retryable synchronization errors and return stored outputs; `refreshVtxos` explicitly invokes synchronization without that fallback wrapper. `getBalance` combines boarding and contract data, so one SDK invocation is not necessarily one HTTP request. `settlementConfig: false` disables background settlement, including migration, in this installed version.

Official documentation supports reuse rather than wallet recreation per read:

- [Create your wallet](https://docs.arkadeos.com/wallets/getting-started/create-your-wallet): create a wallet and use that instance for operations.
- [Checking balances](https://docs.arkadeos.com/wallets/operations/checking-balances) and [asset balances](https://docs.arkadeos.com/wallets/operations/assets/check-balance): balance/holdings are reads on that wallet.
- [Receiving payments](https://docs.arkadeos.com/wallets/operations/receiving-payments): notifications have an explicit subscription lifetime and stop function.
- [Verify asset metadata](https://docs.arkadeos.com/wallets/operations/assets/verify-asset-metadata): asset metadata is immutable; validated details can be reused independently of ownership.
- [Service worker](https://docs.arkadeos.com/wallets/advanced/service-worker): longer-lived wallet connectivity is supported, but a worker is optional and outside this change.

This verifies the SDK mechanism, not a measured live Signet latency or funded transaction outcome. The archived A4 design deliberately accepted repeated initialization to avoid persistent SDK caches/subscriptions. Current requirements already support an account-scoped observer and in-memory view caches; the proposed lifetime replaces that historical implementation trade-off, not the live-read contract. Older balance specs and newer `view-loading-policy` contain different presentation/cache policies: this change neither changes nor arbitrates those policies. Preserve the policy selected by the active loading/cache work and keep authoritative Refresh behavior common to both. Preserve current Signet/Mutinynet support despite older Signet-only planning context.

## Goals / Non-Goals

**Goals:** Establish one private resource owner per root BIS app composition, isolate resource generation from read and presentation lifetimes, and remove wallet reconstruction as a warm-read dependency. Keep transaction safety and complete data validation independently testable.

**Non-Goals:** A singleton across tabs/apps; persistent SDK repositories; a new server or worker; provider latency guarantees; changes to view TTLs, UI loading policy, account eligibility, network support, or user consent. Direct provider-only contract/public-address reads need not be forced through a wallet just to satisfy reuse. No standalone prototype rewrite or external game release/import.

## Decisions

### 1. One private owner with two lazy role slots

Introduce an internal Arkade app-session factory, composed through `context-composition.ts` and the `BisService`/Game Wallet composition. It owns the Player and Game slots and supplies role-bound adapter dependencies; callers cannot supply arbitrary extra identities to the shared owner. Standalone context/controller factories own and dispose their own session by default; when composed together they borrow the same owner rather than independently creating one. Injected test dependencies remain usable.

Direct Node/test-tool callers retain compatible bounded adapter entry points. Give a standalone invocation an explicitly scoped owner or preserve a read-only verification wrapper outside the browser composition; never use a process-global phrase-keyed signer cache. The browser's two-role construction budget does not combine independent CLI processes with the app's wallets. Test those direct callers as well as the browser composition so dependency injection cannot silently break fixture tooling.

Each slot holds an opaque identity handle, selected network/operator, monotonically increasing generation, acquisition promise, in-memory repositories/providers, SDK wallet, observation cleanup, and operation lease state. Do not hash or log recovery phrases as diagnostics. The slot is absent until its role is eligible and actually needed. Zero accounts means zero SDK wallets; a Player-only session needs at most one; eligible Player and Game roles need at most two. Current Game access gating remains unchanged.

Use a signing-capable `Wallet` with `settlementConfig: false` and explicit in-memory wallet/contract repositories for each active slot. Expose narrow internal read/sign interfaces onto that same object, not `toReadonly()` or a second readonly SDK wallet with a separate manager. Read adapters cannot submit through their narrow dependency. Provider/network validation stays mandatory; automatic renewal/sweep/migration is not introduced.

Alternatives: a global phrase-keyed map risks cross-app secret retention; retaining only readonly wallets still requires extra signing wallets; reuse of the existing settlement helper would couple fast reads to history and inadequate default locks. Reject all three.

### 2. Resource, read, and presentation lifetimes are separate

A slot progresses through absent, initializing, ready, retiring, and closed states. Concurrent acquisitions share one promise; an individual caller's abort detaches its lease without aborting other callers. Acquisition has a session-owned deadline, not the first caller's signal. Failed acquisition clears its promise after bounded cleanup so retry is possible. Late creations are immediately retired.

Navigation cancels presentation work, not the role wallet. Explicit Refresh creates a new eligible live-read attempt, not a new resource generation. Identity/network replacement, logout/reset, and disposal increment the resource generation immediately and stop publication. Account A to B to A remains three distinct generations. Game refresh is triggered only by actual role scope or relevant wallet evidence, never every context publication.

Creation/restoration preflight validates local recovery material and network before changing storage. Any SDK validation candidate occupies the target role slot: retire the old resource before creating it; promote the same candidate after successful activation. Failure leaves saved identity data untouched and reacquires the previous identity if necessary. No overlapping candidate and active SDK wallets for one role. If safe retirement is unconfirmed, replacement fails boundedly rather than creating a competing signer.

Alternatives: dispose on last page close defeats reuse; cancellation of shared work on any caller abort breaks other consumers; identity keys without generations permit stale same-profile results.

### 3. Explicit freshness boundaries, not session-wide failure flags

Retain the existing core read coordinator, cache eligibility, invalidation, and retry budgets. Add a private adapter freshness seam with attempt ID, role generation, required data sources, normalized query coverage, live completion evidence, and attempt-local errors. A cached entry can serve eligible navigation under existing policy; it cannot serve forced Refresh or transaction authorization. Joining live work retains its elapsed deadline and consumed attempts.

For forced ownership synchronization, use the retained contract manager's explicit `refreshVtxos` covering the required registered contracts, including the recoverable/inactive scope needed by current asset semantics. Propagate synchronization failure. Derive the required values from a single verified snapshot where practical, avoiding redundant sequential syncs for balance and assets. When SDK aggregation performs further provider calls, those calls must also succeed for their required fields; connection mode or a successful `/v1/info` alone is not proof of fresh ownership. The adapter must not accept the SDK's opportunistic repository fallback as fresh output.

The installed SDK's default refresh is cursor-windowed, not automatically a complete inventory query. For authoritative complete verification, explicitly cover all required contracts and the full relevant time range (for example, `includeInactive: true, after: 0`), or prove an equivalent complete live snapshot. Test old outputs spent outside the incremental window, partial/paginated responses, and missed notifications. Incremental observation can remain an optimization; retaining a discovery cursor cannot substitute for required complete evidence.

Use owner-controlled bounded snapshot preparation to associate required requests with an attempt; share only identical compatible live work. Do not move a mutable global failure Boolean onto shared providers or leave caller abort signals captured by session-wide method overrides. If an SDK aggregation cannot expose reliable request evidence, obtain the required complete live provider snapshot through the private adapter and derive the validated projection from it; do not relax the freshness test. Contract registration knowledge can be reused, but provider signer/policy changes and newly discovered contracts must still be handled.

Independent history/metadata failures must not poison balance. Short snapshot-exclusive phases can serialize access to mutable SDK state; do not hold that lane during full history retrieval, metadata fan-out, or transaction settlement. Every wait retains a finite caller budget. An overlapping watcher success cannot erase a required failure; a later new attempt can recover.

Alternatives: trusting connection state alone misses fallback; a permanent failure latch prevents recovery; serializing every read behind history/settlement defeats the performance objective.

### 4. Ownership is live; immutable metadata is a separate cache

Preserve exact BigInt asset quantities, terminal-spend exclusion, recoverable ownership coverage, and complete-list semantics. Reuse validated immutable metadata by network/operator/asset ID in memory, honoring current metadata normalization and provenance rules. Never cache mutable holdings as metadata. Keep bounded parallel metadata hydration outside the snapshot lane; failed required lookup is unavailable, not an omitted row. Missing optional fields remain missing. Metadata completion cannot publish to an invalid generation.

Preserve the parallel `repair-item-metadata-roundtrip-and-loading` implementation and explicit retry contract; do not reintroduce unbounded relisting. Public-address inventory stays provider-only. An aggregate inventory read must not silently change a public API's authoritative-read semantics.

Alternative: retaining all successful asset lists as authoritative would hide transfers and burns; refetching immutable metadata on every balance wastes unrelated work.

### 5. Observers borrow resources; they do not own disposal

Adapt `activity.ts`, asset change watchers, onboarding inspection, and Game observations to borrow role-session dependencies. A role-level event multiplexer owns subscriptions and dispatches generation-checked notifications to consumers. Retain current subscription/reconciliation coverage, duplicate-notification suppression, and bounded reconnection; do not add a new poller per page. Required internal SDK contract observation can remain, but presentation consumers cannot create competing external subscriptions.

Consumer cleanup unsubscribes and releases its lease only. Role retirement is the only SDK disposal owner. Balance and assets must not wait for a full activity snapshot. Keep the initial read/subscription gap closure and current event-driven invalidation. Unchanged evidence must not repeatedly invalidate pending work.

Alternative: a wallet per observer is simpler to stop but defeats the two-wallet resource budget and duplicates discovery.

### 6. Retained signers preserve existing operation machinery

Migrate sending, boarding, onboarding, mint/burn/delivery, and availability/reconciliation to role leases. Keep existing wallet-operation locks, cross-instance coordination, input reservations, policy checks, checkpoint persistence, and exact postcommit receipt verification. Two-role operations acquire locks in a deterministic role order. Retention supplements rather than replaces those guards.

Move per-operation provider/wallet interceptions into a scoped exclusive submission helper which restores every override in `finally`. Route reads around any SDK method currently under exclusive mutation, with bounded waits; do not let a transient reservation filter or checkpoint hook persist into later work. LTO already has provider-only signing/contract paths; reuse the retained role identity/provider where appropriate without adding SDK wallet objects or weakening contract journals. Do not hold a generic read lock through settlement confirmation.

After submission, view cancellation is not transaction cancellation. Ordinary retirement blocks new leases and visible publication immediately; preserve operation journals/reservations unless the user deliberately invokes existing local cleanup. Dispose when SDK work is safely detached/completed. If cleanup cannot prove an old signer has stopped submitting, quarantine replacement signing without requiring the user to wait for network settlement or preventing local logout. An unresolved network outcome alone is not an active SDK signer.

Confirmed decision: users can log out despite pending or uncertain transactions. Keep the existing risk checkboxes as acknowledgements, with their current non-gating behavior; do not add a reconciliation prerequisite. Explicit logout retains the product's selected-profile cleanup contract, including deletion of that profile's local recovery journals. Immediately invalidate old callbacks, prevent background recovery from recreating deleted records or submitting more work, and never claim logout cancelled or completed the transaction. Loss of local recovery details is the disclosed trade-off, not grounds to disable logout. Admin Reset retains its separate guards. The runner's own conservative prechecks and encrypted vault/ledger are separate from this production logout decision and are not cleared or weakened by this refactor.

Alternatives: a new wallet for each mutation violates the role budget; letting every caller dispose the common signer risks interrupting submitted work; sharing permanently monkeypatched methods risks double spending or incorrect checkpoints.

### 7. Structural performance guarantees and honest latency evidence

Add private/test diagnostics for construction/disposal counts, acquisitions, observer counts, provider calls, in-flight joins, freshness failures, and phase timings. Exclude phrases, signatures, recovery payloads, and secret-bearing objects. Save temporary reports only under `output/reports/retain-app-wallet-sessions/`.

Deterministic acceptance: unchanged warm forced-live balance and asset reads construct/dispose zero additional wallets; Player-only reads initialize zero Game wallets; no history or unrelated Game read is a prerequisite; no new fixed multi-second wait is introduced. Deadline/retry safeguards are not shortened merely to make a stopwatch green.

For live comparison, use the same network/operator, account, and small inventory as the prototype, record cold initialization separately, then at least ten warm forced-live samples for balance and assets, reporting p50/p95 and provider/metadata phases. Record metadata-cold and metadata-warm cases and actual browser request counts. Sub-one-second healthy warm reads are the optimization target, not a universal pass/fail promise when upstream requests exceed that budget. The prototype's displayed balance timing starts after wallet startup; its asset timing starts after balance. Report end-to-end entry latency separately so those numbers are not misrepresented. Record remaining bottlenecks if the target is missed.

Alternative: cache-hit timing alone or reducing failure deadlines conceals rather than removes the reported latency.

## Risks / Trade-offs

- [Longer signing-material lifetime] → Keep all references private and ephemeral, disable background settlement, clear on role retirement, retain encryption at rest, and avoid claiming guaranteed JavaScript memory zeroization.
- [SDK snapshot fallback or hidden sync duplication] → Explicit synchronization, attempt-scoped evidence, failure-after-success tests, request traces, and complete snapshot validation.
- [Shared mutable hooks and watcher races] → Exclusive scoped interception, generation guards, finite waits, cleanup tests, and independent history/metadata lanes.
- [Uncertain submitted SDK work] → Preserve journals/reservations during ordinary retirement and prevent overlapping active signers or blind retry; honor deliberate local logout cleanup without waiting for network confirmation.
- [Upstream latency dominates] → Report provider phases honestly; this refactor does not control indexer/explorer RTT or settlement.
- [Parallel dirty-tree work] → Rebase the implementation plan onto the current metadata/readiness/cache changes without overwriting them; this planning change edits no runtime files.

## Migration Plan

1. Add the private owner and fake-factory lifecycle tests; preserve current public exports and dependency-injection seams.
2. Wire one owner through app composition and role controllers, including account candidate handoff and disposal. Migrate read adapters and observers to borrowers.
3. Migrate all app-session mutation/signing paths and scoped hooks. Audit remaining `Wallet.create`, `ReadonlyWallet.create`, and `withTemporaryWallet` sites: browser app-session construction belongs only to the owner; explicitly scoped standalone CLI verification, prototypes, and test fixtures are separate lifetimes.
4. Exercise lifecycle, freshness, concurrent operation, direct test-runner compatibility, and loading/cache regressions; run typecheck, tests, and builds. Collect read-only live timing evidence with registered protected fixtures on both networks when available. Honor registered test grants and unresolved-operation holds; no new funding or transaction is needed merely to measure reads, and this planning workflow performs no financial operation.
5. Deliver source-level implementation and reports. Package export/import, game rollout, and publishing are separate requests.

Rollback the implementation as a coherent scoped change, retaining encrypted identity and operation journals/reservations except where the user deliberately chose existing local logout cleanup. Never clear storage to recover performance or roll back an already submitted operation. No persistent data migration is required.
