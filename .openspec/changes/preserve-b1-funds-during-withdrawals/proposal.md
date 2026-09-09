## Why

A 1000-sat Arkade-to-Bitcoin withdrawal still reserves the user's entire 263715-sat coin, preventing B1 even after the asset-output indexing defect was corrected. New withdrawals must preserve independently spendable change, and the existing interrupted operation must have an explicit recovery outcome before this issue is described as fully fixed.

## What Changes

- Prepare a dedicated, asset-free withdrawal input before registering a partial withdrawal when existing eligible inputs cannot fund it without holding excess funds. Use a same-account SDK send; preserve all assets in separate owned change.
- Review the complete preparation-plus-withdrawal plan, including fees and amounts. One transfer confirmation authorizes this bounded sequence in the current session; review and status reads never sign. A lost or uncertain preparation cannot be blindly retried or followed by settlement.
- After verified preparation, reserve only the dedicated withdrawal input. B1 must succeed using the remaining change while the Bitcoin withdrawal is still pending, without logout, extra funding, or waiting for withdrawal completion.
- Add durable preparation state and exact receipt verification to the existing transfer coordinator, including account changes, reload, duplicate clicks, late callbacks and receipt/indexer delays.
- Keep the existing registered operation `4428bcbe-72db-43e9-a59d-f39150837dae` intact. Its verified completion or supported terminal cancellation/failure is a separate required acceptance gate; coin preparation cannot consume its reserved input. Reuse the prior recovery investigation and cancellation contract rather than invent a force-clear or a second recovery controller.
- Reconcile the old plan's explicit exclusion of coin splitting: this new proposal brings withdrawal preparation into scope. It retains the output-order correction and input-conflict protections.

## Capabilities

### New Capabilities

- `withdrawal-input-preparation`: Reviewed, durable, asset-preserving preparation of only the funds needed for a Bitcoin withdrawal, with exact verified output handoff.

### Modified Capabilities

- `account-boarding-settlement`: Add preparation to the confirmed withdrawal lifecycle and define compatibility with existing registered operations.
- `wallet-operation-availability`: Require B1 availability from verified remainder during a prepared partial withdrawal; retain whole-input protection for legacy or genuinely unresolved preparation.

## Impact

Runtime work belongs in `BIS/packages/integration/src/arkade/boarding.ts`, an internal preparation adapter, core transfer quotes/records/reservations/reconciliation and the existing UI/status refresh path. The Admin consumes the public API and supplies the exact reproduction acceptance test; no game-repository change is needed.

Installed SDK 0.4.67 exposes `Wallet.send({recipients, selectedVtxos})`, including automatic asset change, so no dependency upgrade or custom cryptography is proposed. The public Send form currently rejects self recipients; keep that policy and use an internal transfer-preparation path with explicit ownership checks. No custom operator server or deployment is proposed.

The existing-account recovery capability is still unproven: the current operator's empty delete acknowledgement does not establish selected-batch finality. This is a delivery dependency, not an assumed capability. Implementing preparation may deliver future-withdrawal availability while the current account remains blocked; that partial result must not close the full issue or the prior change's live recovery gates.
