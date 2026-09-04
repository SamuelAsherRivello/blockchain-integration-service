## Why

Players need to choose how much Bitcoin to hold onchain and how much to hold in Arkade. Confirmed Bitcoin boarding deposits do not inherently become spendable Arkade funds. SDK 0.4.67 also enables background boarding by default for signing wallets, so account inspection must explicitly use read-only wallets rather than relying on a disabled Transfer button.

## What Changes

Account Details shows Total first, then Bitcoin and Arkade balances with individual Copy controls. Bitcoin <-> Arkade sits above Recovery Phrase and opens Account Transfer. Preserve the [D4 user story and ASCII mockups](../../../documentation/User%20Story%20Diagrams.md#d4-make-deposited-bitcoin-available).

Both Bitcoin-to-Arkade and Arkade-to-Bitcoin are required. Each offers a chosen amount, one-sat minus/plus, Max, fee/net/projected-balance review, explicit Confirm Transfer and Back. Unsupported amounts are rejected; a partial request is never silently increased to Max. Switching direction invalidates the quote. No receipt, refresh, login, restoration, elapsed time or achievement request authorizes a transfer.

Bitcoin balance means the account's SDK boarding funds. Arkade balance means its full offchain total, not just spendable funds. Eligibility is separately checked. Reverse transfers use the same identity's SDK-derived boarding address after verifying that the SDK encodes it as an onchain withdrawal destination. This preserves existing Bitcoin balance tracking and later boarding. It is not an external Bitcoin address: existing boarding/exit conditions still apply. Automatic reboarding is disabled.

### Steps to enable

Current priority: investigate the user's reported pending warning with a reported 1,000-sat Arkade balance, then complete Arkade-to-Bitcoin before the return direction. The specific attempt and its outcome have not yet been verified. Review alone must not create a submitted operation. Replace the generic unresolved experience with evidence-based progress, confirmed completion, or verified terminal failure; allow a fresh review after failure only when authoritative evidence proves the attempt cannot settle. SDK/operator support for that negative proof remains to be established. Preserve uncertain attempts and their account-clearing guards.

1. Use read-only identities/wallets for restoration, balances, addresses, funding-address lookup and status reconciliation; only the explicit transfer adapter may sign, with automatic settlement disabled.
2. Verify each direction's SDK input selection, destination, supported amounts, fees and change. Use only spendable asset-free VTXOs for reverse transfers. The currently verified operator fee schedule is zero; reject changes until their exact fee handling is verified.
3. Persist an independent operation lifecycle before registration. Serialize submission, recovery and account clearing using a same-origin Web Lock. Record prepared, submitting, registered and verified outcome plus public operation/intent/commitment IDs.
4. Test interrupted preparation, lost registration responses, duplicate calls/tabs, late callbacks, account isolation and storage failures. An abandoned prepared record can become not-submitted under the lock. Once registration might have occurred, retain pending and reconcile until verified success or authoritative proof of terminal failure that cannot later settle; never automatically replay or trust an SDK cancelled label as proof of failure. Unprovable outcomes can require operator investigation, with no force-clear shortcut.
5. Enable explicit confirmation for each verified quote path, then verify actual user-confirmed Signet transfers, fresh balances and Activity in both directions. Current funds are all in Arkade, so the live test may start Arkade-to-Bitcoin and then return Bitcoin-to-Arkade. Do not waive either test or automatically move funds to manufacture test fixtures.
6. Resume the separate achievement issuance/list/restoration feasibility gate using spendable funds. Successful transfer does not establish achievement implementation completion.

Account clearing stays blocked while a transfer is unresolved, across same-origin tabs and reloads. Closing a view invalidates presentation, not an already-submitted operation. Completion is separate from a failed subsequent balance read. Do not promise execution while the browser is closed or automatic completion of interrupted signing sessions.

## Capabilities

### New Capabilities

- `account-boarding-settlement`: Bidirectional same-account transfer eligibility, review, explicit settlement, durable operation tracking and reconciliation.

### Modified Capabilities

- `account-balance`: Total-first split and transfer entry; fresh reads after completion.
- `account-logout`: Block account clearing while transfer outcome is unresolved.
- `story-driven-demo`: D4 uses the production public API/UI; accurate documentation distinguishes implementation from live verification.

## Impact

Implementation remains in `packages/integration` UI/Core/Arkade layers and `packages/integration-demo` Admin composition. No new dependency or custom server. Signet only. No external destination, automatic funding, automatic transfer, secret journal, or simulated production transaction outcomes. Preserve unrelated story IDs and changes.

A fresh read on 2026-09-04 confirmed Bitcoin 0, settled/available Arkade 289715. The original deposit is confirmed spent by `438f487ba60562e628e4cb5de8d25320d4cc8b7f5ecfefd1f4f7d502fb29413c`; the initiating client has not been proven. See [verification](BOARDING_VERIFICATION.md). The user authorized updating this proposal and applying it, and explicitly reconfirmed both directions.
