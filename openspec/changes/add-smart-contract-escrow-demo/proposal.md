# Proposal

## Why

The demo currently shows payments, assets, wallets, and a separate limited-time treasure flow, but it does not provide a small, general-purpose example of funds being held under programmable conditions. A two-minute escrow gives users a concrete introduction to smart contracts while preserving the existing sender/receiver teaching pattern.

## What Changes

- Add a new Admin section named `Smart Contracts - 1` immediately after Assets.
- Expose four ordered escrow calls: `Send Escrow`, `Check Escrow`, `Approve Escrow`, and `Receive Escrow`.
- Create a two-minute escrow lifecycle with sender, recipient, amount, stable caller-supplied ID, approval flag, status, and remaining-time presentation.
- Allow Send Escrow to request approval at creation with an `approveUponCreation` boolean, while retaining a separate Approve Escrow call.
- Reject escrow creation when its requested ID is already taken; do not silently reuse or overwrite an existing escrow.
- Allow Check Escrow to be called repeatedly as a read-only status operation.
- Make Approve Escrow idempotent: it approves an unapproved escrow and returns the existing approved state when approval already exists.
- Make Receive Escrow perform the actual payment and return truthful already-paid, expired, refunded, pending, confirmed, or failed fallbacks.
- Expire an unapproved escrow after two minutes and prevent receiving it after expiry.
- Make all calls repeatable with stable, truthful fallbacks, except that creating an already-taken ID fails explicitly.
- Display actual operation fee information where the Arkade workflow provides it; Check Escrow SHALL show zero wallet fee.
- Preserve the existing Contracts/Limited-Time Offer section and existing account contract behavior.
- Keep unresolved implementation details, including the exact Arkade approval primitive and Signet fee behavior, subject to capability verification before implementation is reported complete.

## Verification note

The installed `@arkade-os/sdk` version is 0.4.79. Its public declarations expose the LTO-compatible wallet and transaction paths used by BIS, but no separate sender-approval API. The demo consequently implements `Approve Escrow` as an authenticated BIS state transition around the existing LTO and does not claim that approval is a new on-chain opcode. The real funded Signet sequence still requires a user-provided, funded Game Wallet and Player Wallet for acceptance testing.

## Capabilities

### New Capabilities

- `smart-contract-escrow`: A provider-neutral two-party escrow lifecycle with approval, deadline, repeated status checks, fee transparency, and terminal outcomes.

### Modified Capabilities

- `story-driven-demo`: Add the Smart Contracts - 1 Admin section and its four truthful escrow controls after Assets.

## Impact

- Affected Admin navigation, demo console reporting, public/provider-neutral contract types, contract state and persistence, Arkade contract integration, and Signet verification.
- No new chain, custom application server, recovery-secret exposure, or game-facing Arkade-specific API is introduced.
- Existing Contracts, Assets, Payments, and wallet flows remain available and unchanged.
