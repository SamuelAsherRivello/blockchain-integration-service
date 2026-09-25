## Context

See proposal.md for motivation. Account identity is encrypted in browser storage, locally revalidated, and surfaced through the existing context. Creation/restoration use a temporary SDK wallet with in-memory repositories and bounded cleanup. No balance state currently exists. This feature crosses the adapter, core lifecycle, UI, and demo, so an explicit design is warranted.

Evidence checked on 2026-09-03: installed SDK 0.4.67 declarations expose getBalance() and WalletBalance.available/total; the configured operator's GET https://signet.arkade.sh/v1/info returned network=signet. Published semantics are at https://arkade-os.github.io/ts-sdk/interfaces/WalletBalance.html. These checks establish interface availability and current operator reachability, not funded-wallet correctness or freshness. Verify the actual SDK read path before shipping; cached/local SDK fallback must never be treated as a successful live retrieval.

## Goals / Non-Goals

**Goals:** Separate account availability from balance availability, expose a small provider-neutral balance contract, and prevent late asynchronous work from showing data for the wrong account or presentation.

**Non-Goals:** Background synchronization, connection monitoring, persistent balance history, new account persistence rules, additional SDK dependencies, wallet mutations, or extension APIs for assets. This proposal does not claim that available balance guarantees payment success or covers fees.

## Decisions

### 1. Independent ephemeral balance state

Add a provider-neutral balance state to public BisState: idle, loading, ready with availableSats/totalSats, or unavailable. Add refreshBalance() to BisContext. Keep account phase and profile ID separate; accountConnected continues to mean local account activation, not a current network connection. No secret material or Arkade-specific types enter public state or events. UI consumes this state; Admin observes the same public surface.

Reject persisting balances or using the account error phase for network failures. Persistence contradicts the confirmed no-old-data policy; account-level failure would obstruct unrelated controls.

### 2. A fresh bounded read for each Account Details entry or Refresh

Use the locally verified saved identity inside the private adapter to construct a temporary Signet wallet with explicit in-memory repositories, obtain fresh wallet state, map available and total directly to sats, and dispose. Reuse the existing network validation and bounded temporary-wallet lifecycle. Ensure the SDK's balance path actually synchronizes its sources and propagates required-source errors. Validate both amounts as nonnegative safe integers; incomplete or invalid results fail as a whole. Do not calculate available from total or return zero on errors.

Implementation gate: inspect the pinned SDK synchronization path and prove live success versus failed reads with focused tests. If fresh reads cannot be obtained through the pinned SDK, stop and report the incompatibility rather than quietly accepting a cache or changing dependencies. A working operator info endpoint alone is insufficient evidence.

A temporary wallet avoids long-lived subscriptions and persistent SDK caches. Cost: repeated initialization; acceptable for open/manual refresh. No timer or automatic reconnect loop is added. Use the existing 15-second preflight and 20-second temporary-wallet bounds, with the latter covering balance acquisition as well as wallet construction.

### 3. Clear amounts when starting a request

On entry, display Network: Signet and Loading balance... with no amounts; on success display Available balance prominently and Total balance secondarily, both in sats. Refresh clears prior amounts and enters loading. Refresh is disabled during an in-flight request to prevent duplicate work. On failure show Balance unavailable and Unable to retrieve current wallet data. Re-enable Refresh. No stale label, last-updated timestamp, or old-value fallback remains: the final user decision supersedes the earlier stale-value discussion.

Clearing amounts immediately on refresh is a minor implementation choice consistent with rejecting old values. The last successful result remains visible only while this Account Details dialog stays open and no new request has begun; it is a snapshot, not a live-monitoring promise. No separate connected/offline badge is introduced. Browser online status is not proof of Arkade availability.

### 4. Bind results to the account and presentation

Use a dedicated balance request generation/abort controller bound to verified account generation, profile ID, and Account Details dialog presentation. Do not reuse account activation events as refresh triggers indiscriminately. Entering Account Details triggers a fresh read; creation/restoration and cancelling logout return to the Account menu without a read; requesting the already-open view is idempotent.

Leaving the Account Details dialog, opening logout confirmation, account replacement/logout/reset, or disposal cancels/invalidates balance work and clears its state. Late SDK acquisition must still be disposed; late success/failure must not publish. Back remains usable while loading or unavailable; Log Out is offered only by the parent Account menu. Multiple browser instances follow existing account-storage invalidation rules, without sharing balance snapshots. Missing/unreadable account keys stay in the existing account-access error flow and must not become a balance-unavailable success path.

### 5. Two production dialogs and a narrow demo story

All active-account routes first show the Account menu with Account Details, Log Out, and Back. openAccountDetails() enters the Account Details dialog, whose only actions are Refresh and Back to Account; both dialogs show the same three-line logged-in message, shortened code-styled Account ID, and Network: Signet. Account Details and Refresh carry bolt icons; Back does not. The gap above Refresh matches the 10px gap between its actions. Add Account / Account Balance to Admin. It opens the existing production Account route, including the ordinary chooser when no account exists. Do not auto-create a wallet or seed data. A4 completion covers the reduced dialog only; A5 and C4 remain deferred. Preserve story and step IDs, annotating deferred branches rather than renumbering them.

## Risks / Trade-offs

- SDK local fallback or partial-source success -> trace the installed read implementation and reject incomplete reads; test failure after a previously successful request.
- Wrong account or abandoned request publishes a result -> generation checks, cancellation, and late-wallet cleanup tests.
- A funded account is unavailable for live verification -> report the funded check pending; never infer it from a real zero balance or fixture.
- No background refresh -> a displayed snapshot can age while idle; explicit Refresh is the agreed mechanism. Later payment stories can define their own refresh triggers.
- Total may exceed available -> label both explicitly without adding a speculative breakdown or payment guarantee.

## Migration Plan

No stored-data migration. Add the API/state and production UI together, then expose the Admin demonstration and update current documentation. Keep existing creation/restoration/logout checks intact. Roll back through an additive code change removing balance presentation/API wiring if needed; leave account storage and remote funds untouched. Do not rewrite Git history.

## Open Questions

No unresolved product-scope decisions. Which existing Signet account can supply a nonzero verification example can be settled during verification without changing the feature; no transaction or funding action is authorized by this read-only balance feature.
