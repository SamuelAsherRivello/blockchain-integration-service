# Proposal

## Why

The 1,000-sat Admin payment fix still has an overlapping-read edge case: its readiness promise can resolve before the latest eligibility check. The same scan reproduced stale Game Wallet refresh publication and found checkout preflight advancing against an obsolete wallet selection, so timing can incorrectly disable valid actions or prepare a trade for the wrong active session.

## What Changes

- Make Continue readiness represent the latest applicable eligibility read, with account, network, recipient, and controller-lifetime checks before a payment request is created.
- Suppress every obsolete Game Wallet refresh completion, including storage-load role-conflict and network-mismatch branches, before changing selection or public state.
- Capture Marketplace checkout intent and wallet scope before asynchronous preflight; reject stale preparation before journal creation, signing, or advancing another leg. Keep submitted work recoverable under its original identities.
- Prevent late checkout polling and completion handlers from repopulating a replacement session with old UI state or advancing work through its signers.
- Add controlled-promise unit coverage and focused Admin/Marketplace browser regressions for overlapping reads, account/network/recipient changes, disposal, and checkout session replacement. Preserve existing no-duplicate-submission tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pay-to-continue`: Latest-read readiness and explicit lifecycle binding for a payment gesture before submission.
- `admin-game-wallet`: Obsolete refreshes cannot change selection, readiness, addresses, balances, or mismatch diagnostics.
- `marketplace-trading`: Checkout preparation, subsequent legs, recovery callbacks, and UI publication remain bound to their captured wallet sessions and intent.

## Impact

Primary targets are `game-continue.ts`, the Admin payment handler, `game-wallet.ts`, Marketplace `App.tsx`, and their focused test fixtures. A small private scope helper is acceptable if multiple callers need the same checks; SDK types and signing material remain private. No new dependencies, journal migration, server, pricing changes, automatic replacement transactions, or changes to the separate game repository are intended.

Evidence: controlled-promise probes reproduced premature Continue readiness and a stale storage read replacing a ready Game Wallet with a role conflict. A probe of the current checkout handler reproduced advancement for Game Wallet A after the active wallet changed to B during balance preflight; it executed no live payment. Actual loss of funds was not tested or observed.

Related work includes `codify-view-loading-and-cache`, `repair-asset-and-marketplace-reliability`, and `add-local-dual-wallet-marketplace-checkout`. Main Marketplace specs require atomic trading, while the latter active change describes the implemented sequential local POC. This repair adds scope safeguards to either path and does not resolve or alter that protocol-policy difference. Test success must not be described as live settlement acceptance.
