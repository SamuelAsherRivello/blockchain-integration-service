## Why

The Admin can register a 1,000-sat Arkade-to-Bitcoin intent yet remain pending without a transaction ID or demonstrated completion. The integration currently hides intermediate settlement progress, disposes its signing wallet at a deadline, and can observe receipts after interruption but cannot resume signing; passing isolated tests has not established a working live transfer.

## What Changes

- Diagnose the existing registered intent through batch selection, participation confirmation, signing, broadcast and receipt verification before selecting a corrective SDK integration approach. Do not assume the operator, signer or verifier is the root cause.
- Introduce a session-owned transfer coordinator with independent operation identities, explicit progress evidence, worker lifecycle tracking and read-only reconciliation. Screen navigation and presentation refresh must not cancel transfer execution.
- Distinguish active pending work, interrupted work requiring recovery, unavailable verification and verified terminal outcomes. A timeout must not become either false failure or indefinite implied activity.
- Use the exact ordinary acknowledgement: "Transfer pending. You can view progress in Transactions." Do not include a keep-tab-open or refresh warning in that prompt. Transactions supplies evidence-supported progress and actionable recovery information.
- Retain asset preservation, reserved inputs, exact receipt verification and the Yes/Cancel warning before every additional balance transfer in either direction.
- Establish stage-specific recovery only where supported and verified against the installed SDK and operator. Do not blindly replay a registered intent or enable automatic settlement of unrelated funds.
- Make actual Admin Signet completion, Bitcoin/Arkade balance changes and asset retention required acceptance evidence; isolated tests alone cannot complete the change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-boarding-settlement`: Session-independent presentation, observable execution stages, conservative interruption recovery, truthful pending acknowledgement and live completion acceptance.

## Impact

Affected code is the integration's Arkade boarding adapter, temporary-wallet lifecycle, core boarding records/status/context/reconciliation, Account Transfer and Transactions UI, and Admin verification. Keep public host contracts SDK-neutral and existing callers compatible through additive status fields. No new server, wallet custody model, SDK upgrade, network, game deployment or signing-secret persistence is assumed.

This is a lifecycle follow-up to `fix-asset-bearing-arkade-withdrawals` and `add-bitcoin-boarding-settlement`, preserving their asset/input protections and historical evidence. It does not mark their live delivery gates complete. Its revised pending copy supersedes their earlier submitted/keep-tab-open scenario when integrated. `cancel-pending-transfer` retains ownership of cancellation feasibility; this change may consume proven recovery capabilities but does not authorize speculative cancellation. Reconcile overlapping delta requirements before sync/archive so an older change cannot restore stale behavior.

Unresolved: the exact failure stage of operation `72b79ec0-9359-4d57-be8c-0bacf512a5ea`, intent `54bc086c-bcb8-4102-90cf-4f81186c2a44`; the supported recovery boundary for each SDK stage; and whether a narrow adapter correction is sufficient for live completion. The proposed coordinator and evidence model must not be mistaken for proof that this intent can be resumed. Planning authorizes no new transfer.
