## Why

The production Marketplace must not fake a purchase while an atomic asset-for-sats exchange is unavailable.  The existing Admin Marketplace controls can mint a catalog into the Game Wallet and bulk-burn it, but cannot safely exercise the real ownership path from that wallet to the separately logged-in Player Wallet, or clean up one exact Player-owned item.

## What Changes

- Add test-only Admin controls that operate on one freshly verified Stealth & Steel catalog item at a time: **Send Item to Player** and **Burn Item from Player**.
- Add a public, UI-independent exact-asset transfer boundary over the supported Arkade Signet send primitive. It will transfer the selected asset to the current Player Wallet with no sats payment, preserve any non-selected assets as sender change, durably record/reconcile uncertain outcomes, and never report success without verified ownership evidence.
- Require separate active Game Wallet and Player Wallet identities, fresh source/destination holdings and chain classification before every submission, and an explicit confirmation before the irreversible Player-wallet burn.
- Track pending work by exact asset and operation, so an unresolved send or burn protects that item while unrelated Admin controls and other safe item actions stay usable.
- Keep these controls in the integration demo's Admin surface only. Marketplace Buy and Sell remain disabled unless the existing atomic-exchange contract is proven; this change adds no sequential trade fallback, price transfer, listing, or production checkout.

## Capabilities

### New Capabilities

- `admin-marketplace-item-test-controls`: Test-only Admin selection, exact Game-to-Player item delivery, and explicit Player-item cleanup with truthful per-item pending state.

### Modified Capabilities

- `asset-api`: Extend the UI-independent asset boundary with exact, durable, verified asset delivery to another Signet Arkade address.
- `admin-game-wallet`: Extend the H. Marketplace Admin tools to use the distinct active Player Wallet as the destination or owner only for the new test controls, while retaining Game Wallet signing boundaries.

## Impact

- Affects `@bis/integration` core asset operation records, Arkade adapter, public exports, and unit tests.
- Affects `@bis/integration-demo` Admin Marketplace composition, operation presentation, and browser tests.
- Uses the installed Arkade SDK's asset-bearing `Wallet.send` capability; no new dependency, server, wallet credential handling, or Marketplace production trade path is introduced.
