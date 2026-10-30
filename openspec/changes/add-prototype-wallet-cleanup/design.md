# Design

## Context

See proposal.md. SDK 0.4.79 exposes `finalizePendingTxs`, which continues existing checkpoint finalization and retains `hasPendingTx` when unfinished. `recoverVtxos` consolidates swept/preconfirmed subdust into the wallet's own address. Current demo wallet storage preserves HD state but has no sandbox-wide settlement receipt journal. Onboarding and offboarding use isolated repositories, so maintenance evidence must not depend only on their in-memory wallet instances. Existing unrelated working-tree changes must remain intact.

## Goals / Non-Goals

Goals: finish original pending sends, reconcile original batch settlements conservatively, maintain eligible ordinary outputs, and keep the financial teaching operations visible in their existing source files.

Non-goals: Wallet 1 signing, new third-party transfers, clearing contract journals, automatic contract claims/refunds, production BIS or game wallet changes, background renewal, or deleting stuck records as a reset.

## Decisions

1. Add a sandbox maintenance support module and a small Setup control. Capture submitted credentials at activation and scope all work by the full public descriptor and network. Use a Web Lock shared with demo wallet mutation wrappers. Only the private cleanup instance reuses its held lock for SDK recovery settlement. Overlapping normal operations, other instances and tabs receive a busy result. Preserve the SDK's sendBitcoin-to-send delegation without taking a second lock. Do not change SDK transaction selection or outputs for normal demos.

2. Use SDK pending-send continuation instead of reconstructing or resending payments. Keep `hasPendingTx` state in the existing wallet database. If the flag remains or any returned pending ID is not finalized, report incomplete cleanup. Do not add the experimental intent repository: its automatic expiry-based cancellation is less conservative than this feature's uncertainty contract.

3. Wrap settlement submission in the wallet factory's supporting code. Before calling SDK settle, persist a bounded public record containing operation identity, captured input outpoints, expected recipient scripts/amounts/assets, submission-attempt stage and acknowledged commitment ID when available. Hook registration only to distinguish provably unsubmitted failures. Never persist proofs, signed checkpoints or arbitrary exceptions. Retain terminal records. Reconcile only an attributable completed commitment and exact expected owned outputs. A missing response or unspent input does not prove failure.

   Correlate the SDK event stream to the acknowledged intent hash and its selected batch ID before delivering settlement events. SDK 0.4.79's Batch.join otherwise throws on unrelated batch failures and can accept unrelated finalization events after its own finalization stage. Retain only the public intent hash and batch ID. A matching terminal batch failure followed by the SDK's acknowledged intent deletion, or its specific `INVALID_INTENT_PROOF: no matching intents found for intent proof` response, is recorded as failed history. A generic error or lost deletion acknowledgement remains pending. This does not initiate cancellation of an uncertain settlement.

4. Cleanup runs discovery and fresh reads, pending-send continuation, settlement reconciliation, then eligible same-wallet recovery, followed by fresh value/asset verification. It does not bypass contract restrictions or unresolved reservations. Recovery uses the SDK's current fee computation; the expected input/output difference must agree with fresh verified fee terms before dispatch, and owned receipts must preserve all assets and expected net sats. No arbitrary zero-fee/100-sat gate controls button availability. Unverifiable terms produce a concise error before submission.

5. Keep UI feedback local to the network profile using a live status region. Show progress, `Wallet cleaned.`, `Nothing to clean.`, or a static concise error. Disable only the active invocation, capture its identity so editing Setup cannot retarget it, and retain authoritative work when navigating away. No report panel or database reset.

6. Change carrier choices in the existing asset-payment module. Normalize only missing and former 0/1/100 selections to 330, retain 1000, and reject other values. Update the tooltip, overview and focused tests together.

7. The user subsequently authorized confirmed cancellation of stale Signet test recovery intents for acceptance reconciliation. This exception is limited to those test recoveries and requires an explicit operator acknowledgement plus matching retained fund/asset evidence. An absent cache entry alone is insufficient, and older unknown records remain preserved. This does not add automatic cancellation of uncertain transactions to the Setup button.

## Risks / Trade-offs

- Unknown original outcomes cannot always be repaired automatically. Preserve them and stop conflicting recovery rather than pretend the wallet is clean.
- Ordinary SDK recovery can require a batch wait. Keep the operation and captured identity independent of the Setup component's lifetime; do not mistake a display timeout for transaction failure.
- Capturing all historic operations is impossible when earlier versions saved no evidence. Retain existing data and use supported SDK pending discovery; do not invent missing history.
- Reconciliation reads can race indexer propagation. Keep pending records retryable and do not resubmit.
- Network fee terms can change. Revalidate immediately before settlement and verify receipts afterward.

## Migration Plan

Add a new network/descriptor-scoped public journal without replacing existing databases. A rollback removes UI access but retains journal records and wallet state. Migrate former carrier selections lazily when loading each profile. No Git release or publication is part of this change.
