# Proposal

## Why

The C1 Admin mint flow currently treats the selected destination as both the funding source and the receiving wallet. That makes selecting Player wallet attempt to spend Player Wallet funds, which is incompatible with the intended game-owned issuance model and causes misleading insufficient-balance failures when only the Game Wallet is funded.

Now that C1 is being used with a separately funded Game Wallet, the flow needs an explicit source/destination contract so issuance is always funded by the Game Wallet while the operator can choose where the minted asset is delivered.

## What Changes

- Add a visible Source wallet dropdown to C1. It SHALL be fixed to `Game wallet` and SHALL not offer or permit Player Wallet as a source.
- Keep a separate Destination wallet dropdown with `Player wallet` and `Game wallet` choices.
- Change the mint operation to fund asset issuance from the selected Game Wallet in every case.
- When Destination is Game Wallet, retain the issued asset in the source wallet.
- When Destination is Player Wallet, issue from the Game Wallet and deliver the issued quantity to the selected Player Wallet through the existing asset-transfer safeguards.
- Scope balance, pending-operation, retry, unknown-result, and reconciliation state to the Game Wallet source and the chosen destination as applicable; never silently fall back to Player Wallet funding.
- Update Admin console output, user-story documentation, public API contracts, tests, and verification guidance to describe source and destination separately.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `story-driven-demo`: C1 must display a fixed Game Wallet source and an independently selectable Player/Game Wallet destination, with source/destination-specific status and console behavior.
- `asset-api`: generic minting must support a source wallet distinct from the destination wallet, preserving exact quantity, operation identity, and safe recovery across issuance and optional delivery.

## Impact

- Admin C1 composition and form state in `BIS/packages/integration-demo/src/admin/`.
- Public mint preparation and wallet-role routing in the integration-demo layer.
- Core asset request/result boundaries and Arkade issuance/delivery orchestration in `BIS/packages/integration/src/`.
- C1 and asset API tests, plus synchronized `openspec` and user-story documentation.
- No automatic funding, secret exposure, server-side persistence, or change to the separate Marketplace H1 Game Wallet-only batch behavior.
