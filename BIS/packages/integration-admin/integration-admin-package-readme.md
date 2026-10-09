# Integration Admin: BIS Admin

[Back to the main README](../../../README.md)

`@bis/integration-admin` is the development application for exploring BIS behavior through Admin controls and a portrait runtime preview. It consumes `@bis/integration` through public exports and keeps demonstration composition outside the reusable library. The application helps developers exercise account, wallet, asset, payment, and contract flows while observing public results. It is a harness for the integration, not the game itself.

## Admin and runtime preview

The dark Admin panel organizes controls around implemented user stories. The adjacent 9:16 Runtime Preview hosts production integration UI. Selecting Account Button exposes the real Account entry point; selecting Account Dialog opens the existing account flow. These actions do not silently create a wallet. The chooser, remembered account state, and subsequent operations come from the production context rather than a separate demo implementation.

Preview scaling changes the presentation inside the fixed portrait frame while retaining the mounted UI and its account state. Demo-owned styles control the page, navigation, console, and preview frame. Production components retain their own styling. This separation makes the demo useful for checking the same interface that a consuming game mounts, without requiring that game to copy Admin styles or controls.

Admin includes developer-facing game-wallet controls and asset tools. Mint presets fill example metadata; they do not submit a transaction until the user explicitly acts. Listing reads the selected wallet's holdings, and catalog controls exercise the existing Marketplace-related integration. Missing wallets, unavailable balances, and unresolved operations remain visible conditions rather than reasons to substitute another wallet or manufacture a successful result.

The console shows public operation progress and results. Recovery phrases and private signing material must not be included. A pending result is not a completed transaction, and a control appearing in the story catalog does not prove that every live acceptance scenario has been verified. Keep verification claims tied to the corresponding tests and recorded evidence.

## Structure and documentation

The promoted game boundary is `IBis` plus the five-method `IBisGame`, implemented by `BisService` and a game-owned adapter. Admin remains a supported non-game consumer of public context/UI/controller exports; it need not implement a gameplay session or use private facade fields.

`src/client/admin-layer` contains the story controls and Admin composition. `src/client/preview-layer` owns the portrait host. `src/client/ui-layer-react` contains the application shell, demo styling, and documentation presentation. The application creates and subscribes to public production contexts, mounts their UI, and disposes those resources when the host changes. Wallet implementation belongs in the integration package.

The Documentation link opens the current [user-story source](../../documentation/User%20Story%20Diagrams.md) through the documentation renderer. Under the shared server it is available at `/admin/documentation/user-stories/`; its Back link returns to Admin. The separate book entry remains available at `/admin/book.html`. Documentation changes should describe actual behavior and keep stable story identifiers rather than treating historical planning notes as current acceptance.

Reset Client is a development action with production safeguards. It can clear integration-owned remembered state and recreate the demo session, but it must respect unresolved-operation guards and preserve unrelated host data. Ordinary page refresh is different: it retains committed account access. Use isolated test fixtures for cleanup checks instead of casually resetting a funded browser profile.

## Run and verify

Run `npm run dev` from the repository root and open the printed `/admin/` URL. The default port is `5174`; the same server also hosts Marketplace, the onboarding spike, and integration documentation. Admin and Marketplace share BIS storage on their common origin. Data stored under a previous port stays there unless an explicit migration is performed.

Run `npm run typecheck`, `npm test`, and `npm run build --workspace @bis/integration-admin` for the relevant workspace checks and build. Browser fixtures live under `tests/client` and should be treated according to their documented isolation. The production build retains the `/blockchain-integration-service/admin/` base for the existing GitHub Pages release. Starting a development preview does not publish a release or establish live wallet acceptance.
