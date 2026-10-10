# Integration package

[Back to the main README](../../../README.md)

`@bis/integration` is the reusable BIS library for browser games. It owns the production Account UI, application state, wallet operations, and contracts consumed by Admin, Marketplace, and external hosts. Gameplay stays in the consuming game. BIS requires no application server and keeps Arkade SDK types and recovery material behind its integration boundary.

## Responsibilities and public API

Start with `src/index.ts`. `IBis` defines game commands; `BisService` implements them and coordinates lifecycle, UI, equipment, wallet, and contract services. `IBisGame` supplies five host methods, including `onBisEvent`. Import `@bis/integration/style.css` alongside the JavaScript API. Creating, restoring, and selecting wallets remain explicit flows.

Game commands expose copied, readonly `BisSnapshot` projections and named payloads, not controllers or wallet internals. Game payloads use `BisGame` names; system payloads use `Bis` names. The [typechecked boundary example](tests/fixtures/game-contract-types.ts) rejects missing callbacks, private members, and mutable snapshots. Admin and Marketplace retain supported lower-level exports without creating alternative game channels.

`state-layer-core` owns lifecycle, persistence, operation state, and read coordination. `ui-layer-react` owns components and styling. `wallet-layer-arkade` adapts SDK/provider calls; bridge, operation, and game-wallet layers retain their responsibilities. Demo layout changes belong in their consuming package.

## Authoritative item metadata

Minted items share one raw metadata envelope. Native fields identify the asset; BIS fields identify its game record. `bisDescription` is presentation text, never gameplay authority. `bisAttributeDeltas` alone grants gameplay effects: each delta is a signed integer percentage, and a missing `bisAttributeDelta` normalizes to `0`. Trophies provide an empty delta array.

Family, tier, catalog identity, price, and description support display and validation only. Games must reject malformed, duplicate, unknown, or out-of-range deltas instead of inferring effects. See the [equipment definitions and metadata builder](src/client/state-layer-core/equipment.ts) for complete item shapes.

## Accounts, caching, and operations

Remembered accounts use encrypted, origin-scoped browser storage. Refresh and disposal retain committed access. Compromised same-origin code can still access browser secrets; never log recovery phrases or put them in public state, telemetry, or reports. Logout/reset confirmations preserve unresolved-operation guards; clearing local access cannot cancel submitted transactions or erase remote holdings.

After verified account activation and an initial render opportunity, BIS warms balance plus receiving addresses, then missing Transactions, then passive Contracts. Assets preparation requires inventory demand or an Assets visit during the current session; generic capability is insufficient. Marketplace owns its catalog and role-specific inventory caches. Onboarding and Game Wallet retain their workers.

One speculative job runs at a time. Foreground preparation and wallet operations take priority. Opening a page joins compatible pending work without restarting provider calls, deadlines, or retries. Leaving detaches presentation; valid reads may finish into memory. Balance and addresses settle independently, and Details requires both. History readiness reuses the account observer without awaiting its lifetime.

Complete successful snapshots, including empty collections, remain fresh for five minutes. Failed, partial, or obsolete results are excluded. Lifecycle changes and new evidence invalidate dependent work; identical observations do not renew timestamps. Explicit Refresh bypasses the page’s completed values but may join current live work. No TTL refill, new polling, snapshot persistence, or cross-context sharing is added.

Modal pages retain their first-frame construction gate. Details stays interactive with placeholders and spinning Refresh while dependencies are pending. Background failures are silent. Quotes, spending, equipment selection, contract actions, recovery, and reconciliation retain their authoritative checks and explicit boundaries.

## Development and verification

Run `npm run dev` from the repository root. `/integration/` renders this README; `/admin/` and `/marketplace/` exercise consuming applications on the shared server, normally port `5174`. They share account storage on that origin; the onboarding spike uses separate storage. Wallets from older ports are not migrated automatically.

Run `npm run typecheck`, `npm run build`, and `npm test` from the root. Keep fixtures isolated from funded accounts and record live acceptance separately. See [Deep Dive Details](../../documentation/deep-dive-details.md) and the [host-game smoke checks](../../documentation/SMOKE_TEST_BIS_TO_GAME.md) for boundaries and verification limits.
