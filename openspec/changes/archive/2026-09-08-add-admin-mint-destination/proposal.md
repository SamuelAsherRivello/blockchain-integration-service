## Why

Admin now supports Player wallet and Game wallet destinations, but its additional balance precheck can prevent reaching the production mint method used by level-completion collection. Admin must use that same production mint behavior reliably for the selected wallet.

## What Changes

- Add a `Destination` selector with `Player wallet` and `Game wallet` options.
- Route submission and pending-mint recovery through the selected wallet's existing API, with wallet-specific availability and error feedback.
- Latest confirmed revision: preserve production trophy collection and centralize actual issuance through its existing production mint entry point. Remove the independent Admin balance veto; authoritative funding and reservation validation stays inside production submission. Keep game-wallet minting available through the same underlying issuance implementation.
- Keep the selected wallet and operation ID fixed during submission and unresolved recovery.
- Follow-up user request: append `(Player->Game)` to B1 and change F3 to `F3. Send 100 Sats (Game->Player)`, including the actual new-payment amount.
- Proposed default: Game wallet, preserving the current destination. Destination selects the wallet that funds and receives its own issuance; this does not introduce a mint-then-transfer operation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `story-driven-demo`: Extend the Admin mint form with wallet destination selection and wallet-scoped recovery.
- `game-wallet-player-payment`: Change new F3 payments to 100 sats while preserving historical recovery amounts.

## Impact

Demo `App.tsx`, `admin/mint-destination.ts`, `admin/MintAssetDialog.tsx`, C1 availability, focused parity tests, and C1 documentation. Reuse player context and game wallet controller mint APIs; no new SDK dependency or game-facing request field. No change to production reward policy or the separate game's installed package is authorized by this revision. Live Signet verification remains distinct from isolated tests.
