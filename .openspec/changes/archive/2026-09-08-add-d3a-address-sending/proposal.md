## Why

D3a delivers a complete direct Signet send to an Arkade address. The user explicitly separated new sending from recovery of an existing transfer and authorized the narrower route. An affected account's spending lock remains enforced; recovery of that account is not a development prerequisite.

## What Changes

- D3a story: As an account holder, I can enter another Arkade address and a whole-sats amount, review the exact recipient amount and fee, and explicitly send my available Arkade funds.
- Replace Send's coming-soon dialog with recipient/Paste, spendable funds, amount/Max, separate Review Send, explicit confirmation and truthful outcome.
- Support only Arkade-to-Arkade. Omit Bitcoin source/destination selectors, Lightning, QR scanning, fiat, and unavailable route controls.
- Bind confirmation to current account, inputs, amount, recipient and fees; preserve durable transaction identity before submission and prevent duplicate payments after interruption.
- Keep D5 Cancel Pending Transfer in `cancel-pending-transfer` as a separate proposal/story. No cancellation, forced clearing or pending-transfer repair is included here.
- Verify the sending implementation using isolated tests independently of the existing pending account. Real payment verification requires explicitly selected clean Signet accounts and user confirmation; missing live evidence must be reported separately, not mistaken for an implementation blocker.

## Capabilities

### New Capabilities
- `account-address-sending`: Direct Arkade-address sending with exact review, transaction status and duplicate protection.

### Modified Capabilities
- `story-driven-demo`: D3a production Send demonstration, separate D5 recovery story and pending-send Reset protection.
- `account-logout`: Preserve account material while a send is unresolved.

## Impact

UI, provider-neutral Core and SDK adapter remain in packages/integration; demo consumes public APIs. Reuse existing same-origin spending coordination and preserve D4/asset operations. No new dependencies, wallet migration, custom backend, game edits or changes to D5 recovery implementation. Bitcoin address sending is deferred outside this delivery; D3b Lightning sending remains deferred.
