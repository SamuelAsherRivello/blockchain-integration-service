# Design

## Context

See [proposal.md](proposal.md) for motivation and evidence. Three code paths expose the same lifecycle gap:

| Finding | Current boundary | Reproduced sequence | Consequence |
| --- | --- | --- | --- |
| F1: Continue readiness | `game-continue.ts` stores only the first refresh promise as `ready`; subscription events start additional reads | Read A starts, event starts B, A resolves, `readyAsync()` returns while B is pending | Admin rejects an otherwise valid click; B later publishes `idle / canPay: true` |
| F2: Game Wallet refresh | `game-wallet.ts` checks the signal inside `inspect`, but not before storage-result conflict branches | Old storage A waits, refresh B becomes ready, A returns the player identity | A clears selection and publishes a false role conflict over B |
| F3: Checkout scope | Marketplace `beginCheckout` reads funds and recipient before building a record from captured React state; recovery checks cancellation only after work | Game A starts preflight, active selection changes to B, old preflight finishes | Old checkout advances; subsequent calls resolve signers from the replacement controller state |

F1 and F2 were reproduced directly against core modules with deferred promises. F3 was reproduced using the actual checkout handler body with controlled read dependencies; no signing or network submission occurred. Its financial consequences remain unverified.

Existing protections remain valuable: read-generation checks in Continue, abort checks in Game Wallet inspection, wallet mutation locks, durable checkout submission phases, and exact-item reservations. Preserve them. The fix closes the gaps between those boundaries rather than replacing the transaction machinery.

## Goals / Non-Goals

**Goals:** Make asynchronous completion authoritative only for its owning read and session. Make a single Continue gesture survive a same-scope overlapping eligibility read. Reject preparation after meaningful scope replacement. Make all three regressions fail deterministically before the repair and pass afterward.

**Non-Goals:** Prove or change Arkade settlement primitives; migrate checkout journals; alter fee, price, input reservation, asset classification, cache TTL, or explicit logout rules; introduce a generic global task scheduler; change the separate game application.

## Decisions

### 1. Continue readiness follows the latest relevant read

Track the current eligibility promise and read revision together. `readyAsync()` observes the current promise, awaits it, and checks whether another applicable read superseded it; if so, it joins that read before returning. The state update and resolved readiness must refer to the same revision and scope. Coalesce compatible same-scope work so healthy duplicate events cannot perpetually restart readiness. Apply the existing bounded read policy to read work only; never retry a payment through a read retry wrapper.

Capture player identity, network, recipient, and host lifetime when accepting a payment gesture. A scope change ends that gesture instead of following the replacement account. Use a synchronous preparation guard or shared in-flight preparation promise so repeated gestures cannot create several controllers or requests while waiting. Retain the Admin's controller/session equality checks and revalidate immediately before request creation. Release preparation guards in `finally`, including unavailable reads and disposal. `pay()` must preserve existing callers that already inspect `canPay`; the additive `readyAsync()` API remains compatible.

Alternatives rejected: keeping the first promise leaves F1; sleeping for a guessed interval cannot establish readiness; disabling all context notifications loses legitimate updates; treating unknown eligibility as payable bypasses spendability checks.

### 2. Validate Game Wallet refresh ownership before every effect

Capture the refresh signal/generation, selected network, and initiating Player Wallet session before `storage.load()`. Immediately after it settles, check refresh ownership and captured scope before evaluating conflict branches, calling `selectProfile`, or publishing state. Apply the same ownership predicate to inspection, error publication, and observation callbacks. Keep real current conflicts visible and retain valid earlier public data during a current refresh as existing behavior requires.

Do not use only profile equality: same-profile logout/relogin or an A-to-B-to-A transition still replaces the session. Use a monotonic lifecycle generation where scope can repeat. Existing `selectionVersion` and abort ownership should remain the common source of truth rather than competing counters for the same event. Subscribe to lifecycle changes where necessary; dispose all added subscriptions.

Alternatives rejected: guarding successful reads alone misses F2; suppressing all conflicts hides genuine role errors; accepting an old result because its network matches ignores refresh ordering.

### 3. Capture checkout intent and revalidate before each mutation boundary

Move checkout orchestration behind a small testable host boundary if needed. Freeze item identity, quantity, price, direction, public wallet identities/recipients, network, and session generation at gesture acceptance. Before and after each preflight await, and immediately before journal creation, verify that the captured scope still matches authoritative controller state. Bind recipient discovery to the captured player, never whichever account happens to be active when discovery begins. Changing the detail selection must not rewrite an accepted intent.

Guard each payment/delivery callback before invoking its signer. Existing integration-layer account/version and wallet-lock checks remain the final authority when selection changes while a lock or provider call is pending. The host guard must not substitute for those checks. Stop before any next leg when the session no longer matches. Work already submitted retains its original journal and follows existing recovery/explicit-logout semantics; an obsolete callback cannot recreate a journal deleted on logout.

Bind polling to checkout identity and lifecycle generation. Check cancellation and scope before recovery, after awaited status reads, before confirming/advancing a leg, and before React publication. A disposed or replaced poll must not call mutation-capable continuation. Recovery after remount explicitly matches both wallets, network, recipients, and exact operation evidence before advancing. Legacy records lack an explicit network field: validate their bound addresses against the currently selected network before resuming; unavailable validation leaves recovery blocked without rewriting the record or guessing a network.

Alternatives rejected: checking only React `operationLabel` provides no synchronous ownership guard; checking only at gesture start misses changes during awaits; deleting journals on replacement loses submitted-operation recovery; broad global checkout blocking conflicts with existing per-item isolation.

### 4. Regression coverage asserts outcomes and forbidden effects

Use deferred promises to schedule completion order, not arbitrary sleeps. Core tests cover A-before-B and B-before-A resolution, replacement failures, real current conflicts, disposal, network/recipient changes, same-identity session replacement, and recovery after a failed read. Assert exact provider/submission counts and public state, not internal counter values.

For checkout, pause both balance and recipient discovery; replace either wallet or the network; assert zero journal creations and zero signing/submission callbacks from stale preparation. Pause after a submitted first leg; replace the session; verify no second leg and no replacement-session UI publication. Repeat with old recovery polling, logout journal cleanup, and explicit original-scope resumption. Keep same-item duplicate protection and disjoint-item behavior covered.

Extend `smoke-admin-continue-readiness.mjs` to cover overlapping eligibility reads through the actual Admin handler. Add a Marketplace fixture that exercises the real orchestration with controlled read completion and mutation spies proving stale work never reaches a signer. Automated race fixtures do not establish live wallet balances or settlement success; no live funds are required for this repair's acceptance.

## Risks / Trade-offs

- Read churn can starve a latest-read waiter -> coalesce compatible work and enforce the existing bounded policy; use a fresh gesture after scope invalidation.
- An overbroad generation invalidates work on ordinary balance updates -> separate wallet/session replacement from public-data refresh; test both.
- UI cancellation cannot undo a submitted transaction -> retain durable original identities and never retry an uncertain leg automatically.
- Main Marketplace atomic requirements and the active local-POC delta disagree -> add only scope invariants applicable to both; coordinate later spec synchronization with that existing change and do not enable a different trade protocol here.
- Other uncommitted work touches these modules -> apply narrow changes against the current implementation and preserve unrelated edits. The existing unrelated unresolved-transfer eligibility test failure must be baselined separately.

## Migration Plan

Add failing controlled-order regressions, implement each boundary fix, then run the focused tests, TypeScript check, affected production builds, and Admin/Marketplace browser acceptance. Run the existing applicable suite once and distinguish baseline failures from introduced regressions. Keep any generated reports under `output/reports/async-wallet-readiness/` and browser artifacts under `output/playwright/async-wallet-readiness/`.

This is an additive API/behavior repair with no durable schema change. Rollback can revert the implementation independently of stored operation records; submitted operations remain recoverable through their unchanged journals. Deployment or a release is separate from this proposal.
