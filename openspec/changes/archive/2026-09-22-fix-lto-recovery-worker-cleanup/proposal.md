# Proposal

## Why

The LTO recovery worker can fail to finish refund cleanup after its host service is disposed, leaving an ended offer unresolved even though the durable contract record and game wallet are still available. This is now a concrete regression exposed by the focused LTO test and must be repaired before the Start/Claim lifecycle can be considered reliable across reload, tab disposal, and service restart.

## What Changes

- Make recovery-worker disposal reliably enqueue and complete a reconciliation pass for the disposed Player/Game Wallet pair.
- Ensure end-session markers are persisted for every matching unresolved contract before recovery reconciliation begins.
- Preserve recovery records belonging to other operators, networks, players, or game wallets while refunding only the disposed worker's contracts.
- Keep recovery-worker cleanup idempotent and ensure its polling resources stop only after the relevant contracts reach terminal state.
- Add regression coverage for disposal during an active or pending LTO and for unrelated records that must remain untouched.

## Capabilities

### New Capabilities

### Modified Capabilities

- `limited-time-offers`: strengthen durable recovery and wallet-policy behavior so disposed/restarted recovery workers complete scoped cleanup without abandoning unresolved game-owned contracts.

## Impact

- `BIS/packages/integration/src/core/lto-service.ts` recovery-worker disposal, reconciliation scheduling, and scoped end-session persistence.
- LTO and contract-recovery tests, including mocked polling and wallet-operation cleanup.
- No public host API change is intended; existing Start, Claim, Reject, Refund, and contract-query behavior remains compatible.
