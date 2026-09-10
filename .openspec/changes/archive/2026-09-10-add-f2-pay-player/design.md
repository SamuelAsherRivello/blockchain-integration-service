## Context

See proposal.md for motivation and assumptions. The current GameWalletPanel owns a createBisGameWallet controller with import, logout, addresses, balance, and live read events, but no send method. App.tsx owns the active preview context. Arkade sending.ts already exposes quoteSend, submitSend, reconcileSend and injectable SendJournal; continuation.ts demonstrates their journal adaptation. The shared toast queue already supports FIFO notifications and a default 3000 ms hold. F1's ongoing change and broader transfer recovery contain unrelated local edits.

## Goals / Non-Goals

**Goals:** Preserve separate signing identities, exact amount, durable uncertainty handling, and receiver-bound toast delivery using the public integration boundary.

**Non-Goals:** Arbitrary payments, sender inference for unrelated transactions, Continue rewards, new wallet storage, or simulated production receipts.

## Decisions

1. Extend the F1 controller with a fixed-value payment operation and observable eligibility/pending status. The preview supplies public recipient information through App composition; account secrets remain inside integration. Use the selected F1 signer, never the player's signer or configured Continue recipient. A separate hidden player context for sending would risk identity/storage crossover and is rejected.
2. One enabled F2 click is the explicit submission action for the displayed fixed amount. Revalidate both identities, recipient address, spendability including fees, and existing wallet mutation guards immediately before submission. Do not open a player Send form. Disable while preparing or unresolved; do not automatically retry a submission.
3. Reuse the sender-scoped send journal, asset-preserving adapter and shared wallet mutation lock. Store public sender/player correlation keyed by transaction before submission. Retain F1 send recovery across player logout, as F1 boarding already does. Pending records block competing sender mutations; reconciliation never resubmits.
4. Observe incoming SDK transaction evidence in a session-wide read-only observer, independent of Activity visibility. Merge own-transfer journals to classify transfer notifications. Correlate F2 sender metadata only with the correct transaction, player and amount; arbitrary incoming payments use Unknown User. No balance-delta or submission-promise success toasts.
5. Baseline the first successful history snapshot silently; notify on new incoming sats and subsequent pending/final transitions. Use `User <short ID> Sent You <amount> Sats` when known, otherwise `Unknown User Sent You <amount> Sats`; append ` (Pending)` while pending. Own transfers use `Transferred <amount> Sats From Bitcoin To Arkade` or the reverse. Bitcoin final means one confirmation, Arkade final means settled, and own transfers require verified completion. Already-final receipts show only final. Retain first-four/four-periods/last-five ID formatting and default shared duration. Deduplicate by stable transaction or transfer identity. Reconnect preserves baseline; logout/replacement clears session notifications; reload starts a new silent baseline. Exclude change and asset-only receipts.
6. Console reports pending, verified completion, and safe errors; refresh sender and recipient balances from actual reads. Keep source send completion distinct from receipt verification pending. A failed balance refresh does not undo known receipt or manufacture a failure/retryable payment.

## Risks / Trade-offs

- [Unknown SDK receipt-correlation details] → Validate concrete transaction/output evidence with two Signet wallets; remain pending rather than invent success when evidence is unavailable.
- [Double spend after timeout or another tab] → Durable operation identity, shared signer lock, reconciliation and no automatic resubmission.
- [Account changes mid-flight] → Snapshot identities and session generation; recheck before submit and before toast delivery.
- [F1 and transfer work evolves] → Extend current public/controller contracts without reverting parallel work; preserve asset-bearing outputs and existing journals.

## Migration Plan

Add public F2 correlation metadata and reuse the sender-scoped send journal and controller capability without changing retained F1 credentials or existing payment records. Wire the Admin action and update story documentation. Verify isolated behavior, then actual two-wallet Signet receipt. If disabled or rolled back, retain pending financial records and their reconciliation access; do not delete storage.
