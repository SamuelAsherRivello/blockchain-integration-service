# Integration package

[Back to the main README](../../../README.md)

`@bis/integration` is the reusable BIS library for browser games. It owns the production Account UI, application state, wallet operations, and the public contract consumed by Admin, Marketplace, and external game hosts. Gameplay stays in the consuming game. The library provides account, payment, asset, and contract workflows without requiring a BIS application server or exposing Arkade SDK types through its game-facing API.

## Responsibilities and public API

Start with `src/index.ts`, which defines the public exports. `createBisContext()` creates the player context, while `createBisUi(context)` creates the interface mounted inside a host-owned container. Import `@bis/integration/style.css` alongside the JavaScript API. Mounting the interface does not require automatically creating an account; the host can expose the Account button and let the player choose the next action.

The host subscribes to public state and safe events, then releases subscriptions and mounted UI during cleanup. `BisGameServices` provides the game integration facade; asset collection, equipment, continuation, game wallet, and contract helpers support their respective workflows. Admin-only behavior uses the explicit admin context. Consumers should use these exports instead of importing private implementation files or recreating wallet rules in their own presentation code.

The `state-layer-core` directory owns account lifecycle, persistence, operation state, and coordination. `ui-layer-react` owns production components and styling. `wallet-layer-arkade` adapts the SDK, while the bridge, game-wallet, and operation layers organize the remaining host and workflow responsibilities. Keep changes in the layer that owns the behavior: a demo layout adjustment should not require changing production wallet components.

## Accounts and operations

Account creation and restoration are explicit user flows. Recovery input and display stay inside the private production boundary; public state must not contain recovery phrases. Remembered accounts use encrypted, origin-scoped browser persistence, and ordinary refresh or component disposal retains committed account access. Browser-local encryption does not protect against compromised code running on the same origin, so recovery material must never enter logs, shared reports, or application telemetry.

The library supports the configured test networks through its existing wallet configuration. Balance, activity, receiving, sending, boarding, assets, and game-wallet operations depend on actual wallet and provider state. An unavailable or unresolved result must remain distinguishable from success. Hosts should not manufacture transaction completion or bypass pending-operation checks to make a demonstration appear successful.

Logout and reset are explicit operations with their own confirmations and guards. Clearing local account data does not cancel submitted transactions or erase remote assets. Host restart requests and cross-context coordination prevent stale instances from restoring cleared state. Treat reset, spending, and recovery behavior as part of the public contract rather than ordinary component cleanup.

## Development and verification

Run `npm run dev` from the repository root. This package has no standalone application entry point: `/integration/` renders this document on the shared Vite server. Use `/admin/` to exercise the real UI inside the development harness, or `/marketplace/` to inspect another consumer. The default server port is `5174`; use the four URLs printed by the launcher when a different local port is selected.

Admin and Marketplace share BIS account storage when served on the same origin. The standalone onboarding spike uses separate storage. Saved wallets on an older port are not copied into the shared origin automatically.

Run `npm run typecheck` for workspace typing and `npm run build --workspace @bis/integration` for the library build. The root `npm test` command includes the integration tests. Keep automated checks isolated from funded browser accounts, and record live acceptance separately. See the [host-game contract](../../documentation/SMOKE_TEST_BIS_TO_GAME.md) and [user-story documentation](../../documentation/User%20Story%20Diagrams.md) for broader integration and verification context.
