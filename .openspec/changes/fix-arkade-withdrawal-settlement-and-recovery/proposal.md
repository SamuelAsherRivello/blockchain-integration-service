## Why

Arkade-to-Bitcoin withdrawals have registered and confirmed batch participation without a verified Bitcoin receipt. An interrupted withdrawal can reserve the player's sole asset-bearing VTXO indefinitely, causing B1 to report zero spendable sats despite a positive balance; previous button, reconciliation and progress changes did not establish successful live settlement.

## What Changes

- Diagnose and repair the actual failure between batch participation and completed settlement, using the installed SDK batch/signing path and structured, secret-free evidence rather than a mocked successful `settle()` return.
- Establish an operation-specific recovery path for existing interrupted withdrawals: verify completion first, inspect supported intent lookup, and enable explicit cancellation only after its targeting and settlement-race semantics are proven.
- Preserve original operation identities and reservations across navigation, reload and account logout/restoration until verified terminal resolution; logout is not financial recovery.
- Refresh spendable funds, balances and Activity after verified resolution; distinguish temporarily reserved funds from a genuinely insufficient balance when B1 attempts payment.
- Require the user's full account-switch/pay/mint/pay/withdraw/pay sequence, a real confirmed Signet Bitcoin receipt, retained assets and post-resolution payment without logout as acceptance evidence.
- Record official documentation and current upstream issue findings in the design. No reviewed issue establishes the exact local signing failure; proof-based lookup is a capability candidate, not a terminal-status guarantee.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-boarding-settlement`: precise settlement failure evidence, real batch-handler verification and live withdrawal completion acceptance.
- `account-transfer-cancellation`: capability-verified intent inspection and scoped recovery of existing interrupted withdrawals, including cancellation/settlement races.
- `wallet-operation-availability`: durable unresolved reservations and automatic release/recalculation after verified resolution, with accurate B1 messaging.

## Impact

Primary code: `BIS/packages/integration/src/arkade/boarding.ts`, `core/boarding-record.ts`, `core/boarding-reconciliation.ts`, `core/boarding-status.ts`, `core/boarding-execution.ts`, `core/wallet-reservations.ts`, `core/context.ts`, logout cleanup and transaction recovery UI. Tests include the existing `continue-pending-swap-sequence.test.mjs`, SDK batch-handler regression coverage and browser/live acceptance.

The baseline dependency is `@arkade-os/sdk` 0.4.67. No SDK upgrade, custom signing implementation, new server, Boltz integration, automatic cancellation, force-clear, automatic resubmission or pre-withdrawal coin splitting is selected. Any dependency change requires an identified fix and compatibility evidence first.

This change follows the unfinished live gates of `fix-asset-bearing-arkade-withdrawals` and `add-bitcoin-boarding-settlement`, and the documented incomplete outcome of archived `repair-transfer-settlement-lifecycle`. It overlaps `cancel-pending-transfer`; implementation must reconcile shared requirements rather than create a second cancellation controller. Those changes' open acceptance gates remain open until independently satisfied.

Unresolved: the exact SDK/operator failure, deployed operator support for proof-based lookup, and whether its cancellation semantics can prove finality for the old intents. These are explicit investigation gates, not assumed capabilities. Implementation must not be declared complete merely because it reports these limitations more clearly.
