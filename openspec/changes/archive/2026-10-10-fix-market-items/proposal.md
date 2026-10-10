# Proposal

## Why

Marketplace can show an empty Player Wallet tab immediately after BIS Account → Assets has already shown positive holdings. This is a user-visible ownership inconsistency: the shared BIS asset view has fresh evidence, while Marketplace can retain or display a stale/empty classified inventory result.

## What Changes

- Make the Marketplace Player Wallet inventory authoritative against the latest shared BIS asset read after Account → Assets is opened or refreshed.
- Prevent a cached empty Player Wallet result from masking a newly observed non-empty wallet inventory.
- Keep Game Wallet and Player Wallet inventory reads independent, with each tab showing its own fresh, cached, unavailable, or empty state.
- Preserve the three-second Marketplace loading behavior while ensuring the selected wallet result is refreshed before an empty state is presented.
- Add regression coverage for the exact sequence: open Marketplace, open Account, open Assets, observe positive holdings, close BIS, select Player Wallet, and observe those items.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `marketplace-catalog`: Marketplace ownership tabs must reflect the corresponding wallet's latest verified equipment inventory after a shared BIS Assets read.
- `marketplace-inventory-cache`: Cached empty Player Wallet results must not hide a fresh non-empty result, and cross-surface asset reads must invalidate or supersede stale Marketplace inventory.

## Impact

- Affected code: `BIS/packages/marketplace/src/client/marketplace-layer/App.tsx` and `BIS/packages/marketplace/src/client/inventory-layer/inventory-cache.ts`.
- Affected tests: Marketplace catalog and inventory-cache tests, plus a browser-level regression fixture if the existing harness supports the full Account → Assets flow.
- No public API, wallet credential, transaction, or network protocol changes are intended.
