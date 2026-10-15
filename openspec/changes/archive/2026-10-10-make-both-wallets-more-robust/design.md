# Design

## Context

See proposal.md for the motivation. The current Player Wallet balance path already uses the read-only `readWithRetry` policy, while the Game Wallet performs its address and balance reads concurrently and converts any single rejection into `unavailable`. Both paths use fresh Arkade `ReadonlyWallet` instances with in-memory repositories, so neither role should be treated as a durable SDK wallet session or as a privileged first wallet.

The change must preserve the existing distinction between a validated zero balance and unavailable data. It must also preserve role separation, network-scoped Game Wallet storage, cancellation on account changes, and the provider-neutral `IBis`/snapshot boundary.

## Goals / Non-Goals

**Goals:**

- Apply one bounded, cancellable retry policy to Player Wallet and Game Wallet read-only balance/address projections.
- Make Game Wallet recovery from transient provider, indexer, network, and live-observation failures predictable.
- Keep successful reads fresh and identity-bound; never use a prior wallet's data as a fallback.
- Preserve a valid current Game Wallet balance while a failed live subscription is being recovered, then mark it unavailable only when replacement reads fail.
- Expose safe failure categories for Admin diagnostics without exposing provider internals, recovery phrases, or signing material.
- Verify behavior with deterministic failure-injection tests and, where available, live Signet checks.

**Non-Goals:**

- Changing Player/Game Wallet role semantics, network selection, or encrypted persistence.
- Adding a server-side wallet, wallet cache, background balance database, or new Arkade dependency.
- Changing payment, minting, boarding, contract, or asset authorization rules.
- Making the game consume Arkade SDK types or raw wallet controllers.
- Guaranteeing availability when the Arkade operator or indexer remains unavailable after the bounded retry policy.

## Decisions

### 1. Reuse the existing read-only retry primitive

Route Game Wallet inspection through the existing `readWithRetry` helper and keep Player Wallet reads on that same primitive. The helper already bounds each attempt, retries once, propagates cancellation, and aborts the attempt controller in cleanup.

Alternative considered: add an independent retry loop inside `game-wallet.ts`. Rejected because two subtly different policies would recreate the reliability gap this change is intended to remove.

### 2. Retry the complete wallet projection, not individual fields

Each attempt reads the account-bound public address and balance projection as one logical snapshot. A partial attempt is discarded; only an attempt whose required reads and validation complete is published. This prevents an address from one attempt being paired with a balance from another and keeps the existing no-partial-data contract.

Alternative considered: retain a successful address while retrying only balance. Rejected for the initial projection because it complicates identity and network invalidation. The current UI may retain the previous same-wallet projection while a refresh is pending, but it will not publish a mixed or stale terminal result.

### 3. Treat live subscription failure as an observation failure first

The Game Wallet watcher will retain a validated current balance while it attempts bounded recovery reads. A successful recovery re-establishes ready state and observation; only failed recovery transitions the wallet to unavailable. Wallet logout, selection change, network change, disposal, or parent cancellation aborts both the watcher and recovery.

Alternative considered: keep the current balance indefinitely after subscription failure. Rejected because it would present potentially stale financial data as live. Alternative considered: immediately clear the balance. Rejected because a subscription transport failure does not itself prove the already completed balance read was invalid.

### 4. Keep diagnostics at the state boundary

Internal adapter errors will be classified into safe categories such as storage, network mismatch, provider/indexer read, timeout, and observation failure. Public state and Admin console details will expose a sanitized category/message and status, never raw recovery phrases, authorization headers, provider response bodies, or SDK objects.

Alternative considered: expose raw Arkade errors for debugging. Rejected because the project boundary explicitly keeps Arkade details private and raw errors can contain sensitive or unstable implementation data.

### 5. Verify the shipped consumer separately

The BIS source tests will verify the implementation package. The game consumes a vendored archive, so implementation readiness will include checking that the game package is refreshed or explicitly remains out of release scope. No game package replacement is assumed inside this proposal; the final package/release decision is recorded during implementation verification.

## Risks / Trade-offs

- [Retry increases operator traffic] -> Keep the existing two-attempt/30-second bounded policy, abort immediately on cancellation, and do not add polling to foreground Player Wallet balance presentation.
- [A complete read can take longer] -> Preserve visible loading/unavailable states and bounded deadlines; do not fabricate a zero or silently retain a different wallet's value.
- [Live subscription remains unavailable] -> Mark observation unavailable after recovery exhaustion, retain only the last validated same-wallet projection where the spec permits it, and make Details/retry the recovery path.
- [Repeated transient failures obscure the root cause] -> Add safe structured read-status categories and deterministic tests for each failure class while keeping sensitive error detail private.
- [Vendored game package can lag BIS source] -> Include package-version/provenance verification in tasks and require a coordinated package refresh before claiming the game runtime is fixed.
