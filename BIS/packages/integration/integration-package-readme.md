# Integration package

[Back to the main README](../../../README.md)

`@bis/integration` is the reusable BIS library for browser games. It owns the production Account UI, application state, wallet operations, and the public contract consumed by Admin, Marketplace, and external game hosts. Gameplay stays in the consuming game. The library provides account, payment, asset, and contract workflows without requiring a BIS application server or exposing Arkade SDK types through its game-facing API.

## Responsibilities and public API

Start with `src/index.ts`, which defines the public exports. The game boundary is `IBis` (game commands), implemented by `BisService`, and `IBisGame` (five host methods, including `onBisEvent`). The paired game migration and release are tracked in `formalize-bis-game-contracts`; provider tests alone do not establish installed-game compatibility. Import `@bis/integration/style.css` alongside the JavaScript API. Mounting never requires automatically creating an account.

The consolidated game API uses named commands, readonly `BisSnapshot` projections and `IBisGame.onBisEvent`, not returned controllers or wallet internals. Supporting game payloads use `BisGame` names; system payloads use `Bis` names. The [typechecked boundary example](tests/fixtures/game-contract-types.ts) covers both interfaces and rejects missing callbacks, internal members and mutable snapshots. Admin and Marketplace retain their supported lower-level context/UI/controller exports; those are not alternative promoted game channels.

The `state-layer-core` directory owns account lifecycle, persistence, operation state, and coordination. `ui-layer-react` owns production components and styling. `wallet-layer-arkade` adapts the SDK, while the bridge, game-wallet, and operation layers organize the remaining host and workflow responsibilities. Keep changes in the layer that owns the behavior: a demo layout adjustment should not require changing production wallet components.

## Authoritative item metadata

Minted gameplay items use one common raw metadata envelope. Arkade-native fields identify the asset, while BIS fields identify the game record and carry the authoritative gameplay contract. `bisDescription` is intentionally friendly presentation text; consuming games must never parse it. `bisAttributeDeltas` is the only metadata field that may change gameplay. Each delta is a signed integer percentage, and a missing `bisAttributeDelta` is normalized to `0`.

The complete Shoes III shape is:

```json
{
  "name": "Shoes III",
  "ticker": "SHO3",
  "decimals": "0",
  "icon": "https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/shoes-3.png",
  "bisKind": "asset",
  "bisSchemaVersion": "1",
  "bisOperationId": "marketplace-stealth-steel-shoes-3-v3",
  "bisGameId": "stealth-and-steel",
  "bisAssetType": "item",
  "bisCatalogId": "stealth-steel-shoes-3",
  "bisEquipmentFamily": "Shoes",
  "bisTier": "3",
  "bisPriceSats": "3000",
  "bisDescription": "Increases movement speed by 30%.",
  "bisAttributeDeltas": [
    {
      "bisAttribute": "movementSpeed",
      "bisAttributeDelta": 30
    }
  ]
}
```

Trophies use the same envelope and set `bisAssetType` to `trophy`, provide their friendly `bisDescription`, and always provide `"bisAttributeDeltas": []`. Family, tier, catalog identity, price, and description support catalog display and validation only; they cannot grant an effect. Games should reject malformed, duplicate, unknown, or out-of-range deltas rather than infer a replacement from those fields.

## Accounts and operations

Account creation and restoration are explicit user flows. Recovery input and display stay inside the private production boundary; public state must not contain recovery phrases. Remembered accounts use encrypted, origin-scoped browser persistence, and ordinary refresh or component disposal retains committed account access. Browser-local encryption does not protect against compromised code running on the same origin, so recovery material must never enter logs, shared reports, or application telemetry.

The library supports the configured test networks through its existing wallet configuration. Balance, activity, receiving, sending, boarding, assets, and game-wallet operations depend on actual wallet and provider state. An unavailable or unresolved result must remain distinguishable from success. Hosts should not manufacture transaction completion or bypass pending-operation checks to make a demonstration appear successful.

Logout and reset are explicit operations with their own confirmations and guards. Clearing local account data does not cancel submitted transactions or erase remote assets. Host restart requests and cross-context coordination prevent stale instances from restoring cleared state. Treat reset, spending, and recovery behavior as part of the public contract rather than ordinary component cleanup.

### View data caching and loading

The Account views use a provider-neutral, in-memory cache for complete balance, receiving-address, asset, contract, and activity snapshots. Entries are scoped by account, network, and data type and are fresh for five minutes by default; failed or partial reads are never stored, and the cache is not persisted. Account changes, network changes, logout/reset/disposal, wallet observations, operation initiation or completion, cross-context updates, and explicit Refresh invalidate the affected data. A fresh balance may populate Send entry rendering, but Send and Transfer review, quote, and submission always re-read authoritative provider state. Asset and contract mutations similarly invalidate their collection before the next read.

View entry reads start immediately. A modal loading notice waits for the newly mounted view's first browser frame, so the view can construct before the notice covers it; there is no arbitrary fixed delay. Explicit refreshes and foreground mutations remain immediate. Account Details uses non-modal loading, Onboarding remains nonblocking, and the shared Pending Operation Dialog retains its accessibility and abort behavior.

## Development and verification

Run `npm run dev` from the repository root. This package has no standalone application entry point: `/integration/` renders this document on the shared Vite server. Use `/admin/` to exercise the real UI inside the development harness, or `/marketplace/` to inspect another consumer. The default server port is `5174`; use the four URLs printed by the launcher when a different local port is selected.

Admin and Marketplace share BIS account storage when served on the same origin. The standalone onboarding spike uses separate storage. Saved wallets on an older port are not copied into the shared origin automatically.

Run `npm run typecheck` for workspace typing and `npm run build --workspace @bis/integration` for the library build. The root `npm test` command includes the integration tests. Keep automated checks isolated from funded browser accounts, and record live acceptance separately. See the [host-game contract](../../documentation/SMOKE_TEST_BIS_TO_GAME.md) and [user-story documentation](../../documentation/User%20Story%20Diagrams.md) for broader integration and verification context.
