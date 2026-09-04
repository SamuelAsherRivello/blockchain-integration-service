## Context

See proposal.md for motivation and the delta specs for the approved interactions. Receive already displays Arkade and Bitcoin addresses. Core owns account state; Arkade internals own SDK integration; the demo consumes public production surfaces. A5 owns the existing Activity baseline and still has separate live-verification work.

The installed SDK is 0.4.67 without a swap dependency. Official documentation checked on 2026-09-04 describes the [retired Boltz integration](https://docs.arkadeos.com/contracts/lightning-swaps) and an [unserved replacement receiving route](https://docs.arkadeos.com/intents/integrate/lightning#receive-a-payment). A supported live Signet implementation is not established. This design therefore separates an honest unavailable presentation from gated live delivery.

## Goals / Non-Goals

**Goals:** Separate disposable Receive UI state from durable account-owned receiving operations; require reviewed fees before creation; keep recovery independent of the active screen; protect account material until operations are safely resolved.

**Non-Goals:** Sending, permanent Lightning addresses, custom servers, mainnet, automatic invoice replacement, closed-browser execution guarantees, and editing the amount of an existing invoice. No dependency or provider change is implicitly authorized.

## Decisions

### 1. Capability gate before a live adapter

Expose provider-neutral availability and a safe reason through Core. Without verified support, render Currently unavailable with disabled invoice controls while retaining addresses and Back. Do not install a replacement package or call retired endpoints speculatively. Live work requires evidence for Signet receiving, exact payer-amount fees, expiry, recovery, and compatibility, followed by approval of any new dependency/provider. If that evidence is absent, stop live work; the unavailable slice can still be implemented and verified.

Alternative: wire a historical API or fixture into the demo. Rejected because it would misrepresent deliverable receiving capability. Unit-test fixtures remain isolated from runtime outcomes.

### 2. Two state owners

Receive owns selection, amount input, reviewed quote, and the current visit's displayed operation ID. Core owns durable account-scoped operations and a reconciliation supervisor. Navigation disposes presentation only. On account hydration, the supervisor resumes unfinished operations without opening Receive or Activity.

Persist a versioned operation ID, account identity reference, reviewed public terms, provider recovery reference, expiry, lifecycle state, and reconciliation metadata. Any secret recovery material uses the existing encrypted-account storage boundary, never public state or logs. Persist recoverable intent before making an invoice copyable. A storage failure prevents exposure and retains reconciliation responsibility for any uncertain provider creation.

Alternative: keep the operation in the Receive component or Activity fetch. Rejected because leaving either screen would strand recovery.

### 3. Quote review and invoice lifecycle

Use a presentation flow of amount entry → fee review in the same prompt → creation → same-page invoice. First Submit only obtains/reviews terms; second Submit authorizes creation for unchanged valid terms. Clear or edited input invalidates review. Expired/changed quotes return to review. Disable duplicate submissions. Errors remain inline in the current prompt, retaining valid input and offering retry through the existing controls; do not add an extra result dialog.

Validate returned network, amount, expiry, and provider terms before exposing Copy. Hiding and reselecting within a visit restores the same actionable invoice. A new visit starts default presentation but does not cancel old operations. Expiry disables Copy and exposes explicit Renew for the same amount; changed fees require review. Only verified account receipt means Paid. Pending, unknown, expired, and confirmed are distinct from presentation selection.

Alternative: first Submit immediately generates or toggling recreates invoices. Rejected by the confirmed review and reuse requirements.

### 4. Shared clearing guard and recovery serialization

Core computes a non-secret clearing block over every account operation, including hidden invoices and creation in progress. Log Out and Admin Reset both consume this state and recheck it inside the clearing operation. Hydration or uncertain provider outcomes fail closed. The same account-scoped cross-context serialization boundary must protect creation registration and clearing; a UI-disabled button alone is insufficient. Reuse existing generation checks and add a tested cross-context coordination mechanism compatible with supported browsers.

The guard is released only after no operation is payable or needs processing. Local expiry alone cannot discard a held payment or pending claim. An outage can prolong the block; explain why while allowing Back, Receive, Activity, and gameplay. No force-clear escape hatch is introduced.

Alternative: rely on the wallet phrase or warn before clearing. Rejected because it does not prove restoration of unfinished provider-specific recovery state and the user explicitly selected blocking.

### 5. Idempotent reconciliation and Activity projection

Reconcile provider status and wallet receipt before retrying any claim. Persist progress so restart and duplicate notifications cannot create duplicate work. Use provider-supported idempotency/recovery semantics as a live gate rather than assuming exactly-once network delivery. Use available notifications plus bounded reconciliation, with account-generation and disposal checks.

Merge operation observations with A5 wallet history by verified transaction/payment identifiers and account operation linkage. Show pending/confirmed receive transactions once, with payer amount, fee, and net receipt distinguished where available. An unpaid invoice alone is not a pending transaction. Never expose recovery secrets through the public API or Activity.

Alternative: append every provider event as an Activity row. Rejected because it duplicates logical receipts and misstates settlement.

## Risks / Trade-offs

- No supported Signet route → Keep live tasks blocked; never label the unavailable slice as full delivery.
- Browser closes before completion → Persist recovery state and resume on next account load; verify provider recovery deadlines before enabling creation.
- Network ambiguity or outage → Retain recovery and clearing block until reconciled; communicate the block without freezing navigation.
- Simultaneous tabs or response loss → Serialize creation/clearing, persist intent, and reconcile before retry; test crash and race boundaries.
- Duplicate Activity evidence → Reconcile with the active A5 baseline and preserve its unrelated verification status.
- Secret-bearing provider state → Encrypt recovery material and expose only explicitly mapped public fields.

## Migration Plan

1. Implement and verify unavailable capability presentation without new dependencies or live outcomes.
2. Resolve the explicit provider feasibility/approval gate before enabling live receiving. If unavailable, leave subsequent live tasks incomplete.
3. Add versioned recovery storage through additive migration only. Existing accounts start with no receiving operations; unknown or unreadable operation state blocks clearing rather than silently resetting it.
4. Integrate the supervisor, clearing guard, lifecycle UI, Activity projection, and production demo with isolated tests first and real Signet verification afterward.
5. A rollback disables new invoice creation but must retain compatible reconciliation and recovery for existing operations. Do not roll back to a version that can erase unresolved operation state; drain/reconcile operations first. No destructive migration or recovery-state deletion is part of this plan.
