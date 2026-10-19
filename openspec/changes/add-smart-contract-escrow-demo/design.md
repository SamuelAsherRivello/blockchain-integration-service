# Design

## Context

The existing Admin panel renders ordered story sections, while the integration package already owns provider-neutral contract projections, persistence, lifecycle guards, and Arkade-specific execution. The current limited-time treasure implementation is a separate contract purpose and must remain intact. See proposal.md and the `account-contracts` and `story-driven-demo` specifications for the behavioral boundary.

## Goals / Non-Goals

**Goals:**

- Add a small escrow state machine that is understandable in a split sender/recipient demo.
- Keep the game-facing and Admin-facing surfaces provider-neutral.
- Use real Arkade quote, submission, reconciliation, and recovery paths on Signet.
- Make Check Escrow repeatable and free of wallet mutations.
- Show dynamic fee information rather than inventing a universal Arkade fee.

**Non-Goals:**

- Replacing or generalizing the existing treasure LTO.
- Adding an arbitrary smart-contract VM, oracle, custom server, or new blockchain.
- Simulating successful funding, approval, or receipt in the production demo.
- Exposing mnemonics, private keys, raw provider errors, or private contract scripts.

## Decisions

1. **Separate contract purpose and durable records.** Use a distinct escrow purpose and stable record fields so escrow queries cannot collide with treasure offers or existing account contracts.

2. **Four explicit host calls.** Model Send, Check, Approve, and Receive as named provider-neutral operations. Send accepts a caller-supplied unique ID and `approveUponCreation`; Check reads the current contract projection; Approve is a separate idempotent state transition; Receive performs the payment. This preserves the teaching sequence and avoids coupling UI buttons to Arkade SDK types.

3. **Two-minute deadline in the contract state.** Store an absolute expiration timestamp and derive the displayed seconds remaining from current time. The UI timer is presentation only; eligibility is enforced again by the contract workflow and provider evidence. Expired funds follow the sender refund/recovery path.

4. **Quote fees at the operation boundary.** Send, Receive, and expired-fund recovery are expected to have dynamic Arkade/operator/network costs. Approval may be signature-only or may require settlement depending on the supported Arkade primitive. The implementation must inspect the SDK’s current Signet capabilities and show the returned quote, including zero when applicable.

5. **Idempotency is keyed by escrow ID and operation state.** Repeated Check, Approve, Receive, and recovery calls return the current result without duplicate mutations. A Send call with an already-used ID is a hard creation failure and never overwrites the existing record.

6. **Preserve existing contract presentation patterns.** Reuse sanitized status, evidence freshness, pending/confirmed handling, targeted reconciliation, and terminal-record visibility from account-contracts rather than creating an Admin-only shadow ledger.

## Risks / Trade-offs

- [Risk] Arkade’s currently supported contract primitives may not expose a distinct sender approval step. → The installed Arkade SDK 0.4.79 exposes the existing LTO fund/claim/refund path but no separate approval primitive in its public API. This slice therefore treats approval as a sender-authorized BIS gate around the LTO record and documents that limitation; a chain-native approval path remains a follow-up.
- [Risk] A two-minute wall-clock display can differ from Bitcoin block-time enforcement. → Treat the display as an estimate and show the contract deadline/status returned by the provider as authoritative.
- [Risk] Off-chain Arkade state depends on operator availability and VTXO lifecycle. → Surface unavailable/stale evidence and preserve recovery/reconciliation rather than treating a missing read as expired or empty.
- [Risk] Fees can vary with inputs, operator policy, and settlement path. → Never hard-code a fee; show quote and final fee separately.
- [Risk] A retry can race with the first operation. → Persist the escrow ID and operation state before submission, then reconcile the existing operation on repeat calls.

## Open Questions

- Confirm whether the chosen Arkade contract path charges a provider/network fee for Approve Escrow or records it as a signature-only transition.
- Confirm whether an expired escrow needs a sender refund call in the first slice or only an `Expired` terminal presentation.
