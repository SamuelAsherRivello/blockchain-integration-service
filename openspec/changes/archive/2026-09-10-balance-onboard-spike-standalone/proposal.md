## Why

The existing BIS transfer flow has not demonstrated the requested Bitcoin-to-Arkade onboarding. A fresh standalone Signet spike must prove the SDK capability independently of BIS state and code.

## What Changes

- Add an independent Vite app using Arkade OS directly, with a fresh persistent browser account and copyable Bitcoin boarding address.
- Let the user faucet the address and authorize automatic waiting followed by boarding exactly half the funded amount, rounded down, with fees from the Bitcoin remainder.
- Preserve the account and operation across reopening; reconcile uncertain submissions without duplicate submission.
- Show fresh balances and transaction evidence; live completion requires spendable Arkade funds and verified Bitcoin change.

## Capabilities

### New Capabilities
- `standalone-boarding-spike`: isolated Signet funding and partial onboarding demonstration.

### Modified Capabilities
None.

## Impact

New `BIS/packages/balance-onboard-spike-standalone/` package and independent localhost Vite port. No imports from BIS integration and no existing wallet state changes. Operator-compatible half onboarding uses a full boarding settlement followed by a Bitcoin-return settlement; the operator rejects direct partial boarding with onchain change. Both commitments and the final exact spendable target must be verified live.
