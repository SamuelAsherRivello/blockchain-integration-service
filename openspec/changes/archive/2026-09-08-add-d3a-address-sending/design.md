## Context

See proposal.md. SDK 0.4.67 provides direct Wallet.send with selected VTXOs, exact recipient/change outputs and finalization. Existing Bitcoin holdings are boarding deposits, not an ordinary onchain source. D5 recovery is independently blocked; that must not stop development of D3a.

## Goals / Non-Goals

**Goals:** A usable direct-send flow and production public API with account/quote binding and durable duplicate protection.
**Non-Goals:** Bitcoin destinations, Lightning, automatic conversion, cancellation of any existing transfer, new dependencies or background payments.

## Decisions

- One route and one source: Arkade. Read-only preparation validates a test-network Arkade address against the configured operator, excludes asset-bearing/unavailable VTXOs, and obtains live spendability. Reject self-send to keep outgoing accounting unambiguous.
- Use selected asset-free inputs; reject sub-dust change instead of donating or silently changing amounts. The inspected direct-send implementation conserves input/output sats; recheck the operator fee schedule and prepared transaction before submission. Only verified zero-fee direct sending is supported by this installed adapter; changed schedules require re-verification, not guessed fees.
- A fresh quote has a short expiry and fingerprints profile, input outpoints/values, recipient, amount and operator data. Core issues and consumes the actual reviewed quote; forged, replayed, changed or expired terms fail before payment.
- The adapter intercepts the SDK submission boundary: decode the SDK transaction using its exported Transaction class, verify reviewed recipient/change/input conservation, and durably save its public transaction ID before the first network call. Store no signed payload, key or phrase in the journal.
- Reuse the wallet mutation lock; new sends preserve existing transfer and mint guards. Pending sends block transfer/mint/account clearing. Reopening reads the same operation. Check Status is read-only; finalization acknowledgement or exact finalized indexer evidence can establish success. Missing evidence remains pending with no automatic resubmission.
- SDK signing wallets disable automatic settlement. Late callbacks cannot begin submission after cancellation/disposal/deadline. Success persistence failures remain conservatively pending.
- Use existing light UI and lightning loader. Review shows full wrapping recipient, source, network, exact sats, fee and total. Back preserves draft; user edits invalidate review. Clipboard races cannot overwrite newer edits.
- D3a Admin opens the production API, not a fixture. Tests may use isolated doubles; production never fabricates balances or outcomes. D5 has its own proposal and story and is not an apply prerequisite.

## Risks / Trade-offs

- Unknown submission outcomes can require investigation; preserve guards rather than retry blindly.
- A new operator fee schedule blocks preparation until supported, as an operational error, not an advertised unsupported route.
- Same-origin locks cannot coordinate another device; fresh input revalidation and operator double-spend rejection remain necessary.
- A locked existing account cannot perform live verification. Use a separately selected clean account/profile without clearing the existing journal; report missing live evidence explicitly.

## Migration Plan

Add a versioned non-secret send journal; preserve existing transfer/account records. Deploy the production flow after automated and browser checks. Rollback must retain pending-send guards and readable recovery state. Do not archive before live acceptance is evidenced.
