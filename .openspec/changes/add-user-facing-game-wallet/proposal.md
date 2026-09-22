## Why

D.P.2 currently depends on a hosted BIS wallet service for its game signer. A runtime preview or deployed game without that service silently has no usable offer path or lifecycle feedback, even though the game itself remains playable. The product needs a serverless BIS-owned contract flow in which a player can configure the game wallet directly from the BIS account UI when no Admin exists.

## What Changes

- Define the canonical catalog: **A.G.1. Game Wallet (Admin-facing)**, **A.G.2. Game Wallet (User-facing)**, and **A.G.3. Board Game Wallet**.
- Make A.G.1 and A.G.2 two entry points to the same browser-and-origin-scoped game-wallet selection. A.G.3 remains an Admin-only action that uses that same selected wallet.
- Add the A.G.2 `Game Wallet Login` entry below `Get Recovery Phrase` in Account Details > Balance. It provides a game-wallet-only Create / Restore flow and, when configured, requires Log Out Game Wallet before offering Create / Restore again; it does not expose game-wallet balances or boarding controls.
- Replace D.P.2's BIS-hosted wallet-service dependency with the selected local game-wallet controller and direct Arkade contract operations. No BIS application server is required for Admin preview, runtime preview, or a consuming game.
- Remove the obsolete `BIS/packages/wallet-service` package and its hosted-wallet adapters, scripts, service-only tests, and documentation after all A.G.1/A.G.2/A.G.3 and D.P.2 callers use the local controller.
- Preserve uninterrupted play when the player wallet or game wallet is absent. A run that starts without the game wallet silently has no D.P.2 offer; changing the game wallet starts a clean new D.P.2 presentation session rather than surfacing history from the replaced wallet.
- Require funding, claim, and refund to emit deduplicated pending and confirmed runtime toasts through the existing BIS toast layer.

## Capabilities

### New Capabilities

- `user-facing-game-wallet`: A.G.2 setup, restoration, deselection, and lifecycle behavior for the locally selected game wallet in every BIS user-facing host.

### Modified Capabilities

- `admin-game-wallet`: Renumber Admin controls as A.G.1/A.G.3 and bind them to the same local game-wallet selection as A.G.2.
- `limited-time-offers`: Make automatic funding and recovery use the selected local game wallet rather than a BIS-hosted signer service.
- `treasure-lto-demo`: Make D.P.2 consumer integration serverless and reset its visible session state when the selected game wallet changes.

## Impact

- Affected BIS areas: game-wallet storage/controller and public composition APIs, runtime Account UI, local LTO implementation and tests, and integration-demo Admin/preview composition.
- Affected consumer: Stealth & Steel's BIS integration, treasure session behavior, package update, and browser verification.
- The existing hosted wallet-service route, package, and service-owned signing model are removed. Arkade operator connectivity remains necessary for real Arkade operations.
- Existing private recovery UI and encrypted browser storage remain the only places recovery material is handled; no recovery material is added to public state, logs, build artifacts, or configuration files.
