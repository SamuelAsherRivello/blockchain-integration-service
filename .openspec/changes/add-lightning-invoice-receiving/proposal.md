## Current decision (2026-09-04)

Lightning invoice receiving is deferred and its entire UI is hidden, including the disabled placeholder. The user reports "Lightning unavailable: No Lightning solver available" at https://signet.arkade.money/. This decision supersedes the unavailable-presentation requirements below and in this change's earlier artifacts. Preserve the live-flow design for future work. Restore invoice UI only after a supported Signet receiving route, compatible approved dependencies, pre-generation fee quotes, invoice validation/expiry, durable receipt recovery, Activity reconciliation, and Log Out/Reset guards are implemented and verified together with a real Signet receipt. Solver availability alone is insufficient. See [D2b](../../../documentation/User%20Story%20Diagrams.md#d2b-receive-funds-using-lightning-invoices).

## Why

Receive currently exposes Arkade and Bitcoin addresses but no clearly separated invoice flow. The confirmed user-story design adds Lightning receiving without changing those addresses or conflating receiving with the separate all-send-types feature.

## What Changes

- Add a Lightning invoice section below the existing address fields, with Copy and adjacent No Invoice / With Invoice controls; default to No Invoice, amount 0, and no displayed invoice.
- Capture the confirmed amount prompt, Clear/Submit, payer-amount fee semantics, same-page invoice display, temporary hide/reuse, expiration/Renew, and Paid/disabled-Copy behavior. The first Submit displays payer amount, fee, and net receipt in the same prompt; the second Submit generates the invoice.
- Reset Receive presentation on leaving while keeping pending receipts recoverable, processing outside Receive, resuming after restart, and showing pending/confirmed receipts in Activity.
- Keep invoice controls unavailable until a supported Signet receiving route, compatible dependencies, and recovery behavior are verified. Implementing an unavailable presentation is not completion of the live receiving feature.
- Include the production Admin demonstration and D2 story synchronization as implementation work. Existing A/B/C stories and the separate D3 all-send-types scope remain intact.
- Exclude sending, paid continuation, new payment formats for Arkade/Bitcoin, reusable Lightning addresses, mainnet, a custom server, and guaranteed processing with the browser closed.

## Capabilities

### New Capabilities

- `account-invoice-receiving`: Separated Receive presentation, Lightning invoice lifecycle, availability gating, durable receipt processing, and integration with Activity.

### Modified Capabilities

- `account-logout`: Block account clearing while an invoice remains payable or receipt processing is unresolved.
- `story-driven-demo`: Add a truthful production receiving demonstration and synchronized D2 documentation, without treating unavailable functionality or test fixtures as verified payments.

## Impact

Implementation will affect integration UI/Core/Arkade internals, account-owned recovery storage, the existing Activity presentation, and the demo catalog/documentation. Public state must remain provider-neutral and secret-free. The active A5 change owns the existing Activity baseline and must be reconciled before extending it; its unrelated pending verification is not resolved here.

The installed SDK is pinned to 0.4.67 and no swap dependency is installed. Official documentation checked on 2026-09-04 retires Boltz and describes the replacement receive route as unserved. No endpoint, package upgrade, dependency addition, or network change is approved by this proposal. Feasibility investigation must identify a supported Signet route before live implementation proceeds.

The two-step Submit interaction and blocking Log Out and Reset while invoices remain payable or receipts need processing are confirmed. Ordinary navigation remains available. Editing an existing invoice's amount is not added in this scope; selecting it again reuses it as specified. Minor error presentation follows existing inline error/retry conventions. Provider/package selection remains an explicit live-delivery gate, not authorization to add a dependency. Planning files are the only files created by this proposal workflow.
