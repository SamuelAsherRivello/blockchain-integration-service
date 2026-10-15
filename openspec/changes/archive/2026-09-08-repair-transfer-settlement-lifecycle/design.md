## Context

See proposal.md for motivation. Inspection used the current checkout and SDK 0.4.67. The boarding adapter returns durable registration acknowledgement while retaining a background wallet.settle call. It uses in-memory SDK repositories and a temporary-wallet deadline that disposes the signer. Public journals have prepared/submitting/registered phases, a commitment when returned, and broad interruption categories. Receipt reconciliation is read-only and cannot resume signing.

The installed SDK subscribes to events, registers, joins a batch, confirms participation, signs tree/forfeit transactions where required and returns a commitment. Its observational callbacks can expose progress. Its stale-intent reconciliation does not establish safe signing-session resumption. The [official settlement workflow](https://docs.arkadeos.com/arkd/transactions/onchain-settlement) describes these distinct stages. Current operator capabilities must be rechecked during implementation.

The reported intent has no verified completion in our evidence. Registration alone does not distinguish missed selection, signing interruption, operator failure or a missed receipt. No root cause or resume capability is claimed.

## Goals / Non-Goals

**Goals:** Explicit session ownership, useful public progress evidence, safe interruption handling, independent reservations, harmless ordinary navigation and demonstrated live completion.

**Non-Goals:** A new backend, custody changes, a different withdrawal protocol, unattended signing after document termination, speculative cancellation, automatic re-registration, unproven SDK upgrades or game deployment. Persisting signing secrets or MuSig nonce/session material requires a separate security design and is outside this proposal.

## Decisions

### Diagnose the existing intent before choosing the repair

Correlate operation 72b79ec0-9359-4d57-be8c-0bacf512a5ea and intent 54bc086c-bcb8-4102-90cf-4f81186c2a44 with public diagnostics, batch events, consumed outpoints and receipts. Record the last evidenced stage and missing evidence. If no authoritative intent lookup exists, state the limitation; contacting operator support requires separate authorization. Do not infer the cause from elapsed time.

Correct the identified integration fault within the existing SDK/browser architecture. If evidence proves a server, incompatible SDK or custody change is necessary, stop dependent work and revise this proposal rather than expand scope silently. The lifecycle/evidence model remains useful regardless of the failing stage.

### Evolve execution into a session-owned coordinator

Core owns the operation registry and subscriptions; the Arkade adapter owns SDK tasks; React observes public status. Extend the existing background worker instead of introducing a second signing path. Screen unmount, data refresh and Admin story changes must not dispose active signers. Keep account locking around validation/reservation/registration and browser-wide protection while signing prevents conflicting session clearing. Explicit context termination is distinct from closing a panel.

A service worker is not assumed to guarantee continuous signing. A backend is unnecessary for the requested open-session behavior and would change the architecture and security scope.

### Separate stage, financial outcome and evidence freshness

Add compatible public fields for observed stage, observation time, execution condition, safe diagnostic category and known batch/transaction references. Preserve existing IDs and outcome meanings. Interpret missing legacy evidence as unknown, never active by default. Represent authoritative terminal failure only when supported proof exists.

Conceptual stages: registered -> batch selected -> signing -> broadcast -> confirmed. Protocol-inapplicable stages can be skipped. An unsigned commitment ID is not proof of broadcast. Interruption and unavailable verification are separate dimensions. Serialize updates per operation and merge evidence so stale reads or late callbacks cannot erase stronger proof or affect another operation.

Use observational SDK events and narrowly scoped provider acknowledgements. Store public metadata only, never proofs, raw SDK errors, nonces or secrets. Instrumentation failure must not break signing. Exact receipt and asset checks remain decisive; fix any demonstrated verifier mismatch without relaxing checks to manufacture success. Multiple local transfers may share a commitment and require operation-specific input/receipt matching.

### Observe worker completion and bound recovery

Retain and observe each worker's completion/rejection after acknowledgement. A deadline can end work but must record interruption rather than imply perpetual activity. Derive supported deadlines from operator scheduling and observed phase; increasing the timeout alone is not a repair.

Before enabling continuation, build a stage matrix naming retained state, supported SDK method, duplicate-prevention conditions and required evidence. In-session continuation must preserve the exact intent under the original authorization. Status refresh remains read-only. After lost session state, signing recovery requires explicit authorization and a proven safe SDK path without new secret persistence; otherwise retain reservations and report recovery needed. The separate cancellation proposal owns cancellation feasibility. No speculative delete/re-register fallback.

### Keep the acknowledgement simple

Use exactly: "Transfer pending. You can view progress in Transactions." A title/body split is acceptable with the same wording and punctuation. Omit keep-tab-open and refresh instructions. Transactions distinguishes active progress, interruption and unavailable verification without exposing internal APIs. Preserve the Yes/Cancel warning for every additional balance transfer in either direction, the summed pending amount and fresh pending-ID check at final confirmation.

Ordinary navigation must not affect execution. Session-ending actions and browser suspension are not covered by an unlimited promise that every action is harmless; retain relevant protections at those actions rather than in the acknowledgement.

### Make live completion the acceptance boundary

Pure transition/reservation tests establish logic only. Do not introduce simulated transaction outcomes into the product or claim them as live evidence. Verify the real SDK/operator flow in Admin, including an explicitly confirmed withdrawal, confirmed Bitcoin receipt, asset retention, then boarding independently. Navigate during processing; check final balances, Transactions, explorer and read-only recovery. Do not reload or hot-reload an actively signing document while investigating it.

## Risks / Trade-offs

- Existing intent may not be resumable -> preserve it and report the evidence limit without creating a replacement.
- Events may arrive out of order or share commitments -> exact operation IDs, serialized merges and input-specific receipt checks.
- Browser may suspend execution -> no visibility-triggered cancellation, honest interruption status, no uptime guarantee.
- Legacy records lack stages -> additive interpretation, conservative reservations, no invented progress.
- Overlapping deltas contain old copy -> reconcile complete requirement blocks before sync/archive; preserve unaffected asset scenarios and historical task evidence.

## Migration Plan

1. Capture the failure boundary and SDK recovery matrix before changing the live session.
2. Implement additive lifecycle/status changes and the evidenced adapter correction while preserving journal/API compatibility.
3. Verify navigation/interruption logic and real Admin transfers. Record revision, network and public evidence. Leave live gates open when funding, finality or safe continuation is unavailable.
4. Reconcile overlapping boarding deltas before sync; older checked tasks remain historical verification, not acceptance of this redesign. Game delivery stays separate.
5. On regression, stop new affected submissions and apply a forward correction. Never clear journals, discard new records, rewrite Git history or replay unresolved intents.

## Open Questions

- Which stage does available evidence establish for the existing intent? This selects the narrow integration repair, not a new architecture.
- Which interruption stages support exact-operation continuation with retained state? Unsupported stages use the specified recovery-needed fallback. Any need for secret persistence or a server requires a revised scope.
