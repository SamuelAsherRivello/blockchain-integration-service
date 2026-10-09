# BIS Marketplace

[Back to the main README](../../../README.md)

`@bis/marketplace` is the browser application for viewing and trading Stealth & Steel equipment through BIS. It brings together catalog presentation, wallet inventory, item details, and the production Account UI. The application consumes `@bis/integration` through its public exports; wallet and transaction rules remain in that library. Marketplace owns how the user browses the available information and initiates supported actions.

## Catalog and inventory

The application reads its catalog configuration from `public/catalog.json`. That document contains registered game identities and optional public game-wallet addresses. `Stealth & Steel` has the published address and issued equipment; `Rogue's Dungeon` is currently a registration-only entry with no wallet, assets, or equipment catalog. Selecting that entry is safe and intentionally produces an empty state rather than a fabricated listing or an attempted wallet query. Catalog loading is separate from reading actual wallet holdings: a configured item or address alone does not prove that a particular wallet currently owns an asset. Inventory views use the integration's classification and wallet-reading behavior to present the equipment that can be established from available data.

The interface provides owner, game, and equipment-type filters. Equipment families include Shoes, Daggers, and Shields, with item artwork, tier, effects, and pricing presented in the catalog and detail views. Filtering changes the displayed selection; it does not transfer ownership or alter the underlying wallet. Empty results and unavailable information should stay distinguishable from a successful purchase or a populated inventory. Registering a future game does not add it to the Admin mint batch: issuance remains derived from the integration package's verified Stealth & Steel equipment definitions until that future game receives its own explicit catalog design.

Selecting an item opens its details and the actions appropriate to the current wallet state. Identifiers and explorer links help inspect the represented asset. Artwork and descriptive metadata are presentation inputs, so they must not be used as substitutes for verified ownership or transaction status. Keep item classification consistent with the public equipment definitions exported by the integration library.

## Accounts and trading

The Account control mounts the shared BIS UI. The player context handles player account access, while the separate game-wallet controller supplies the game side of supported local checkout. The interface communicates whether listing and sales are enabled for the available configuration. Trading requires the appropriate connected wallets and existing operation checks; browsing a catalog must not automatically create accounts or submit a payment.

Buy and Sell use the integration's checkout coordination and wallet operations. Their progress can include payment, asset delivery, and reconciliation. A pending checkout is not equivalent to confirmed ownership, and an interrupted request must not be blindly resubmitted. The application keeps explicit loading and error presentation around these operations and refreshes the relevant inventory when the workflow provides a result.

Admin and Marketplace use the same BIS storage namespaces when served on one origin. This lets both applications observe the accounts selected for that browser origin. The standalone onboarding spike retains separate storage. Moving from an older development port to the shared server does not migrate that port's saved wallet data, and switching pages should not be treated as permission to clear account or recovery records.

## Structure and development

The promoted game boundary is `IBis`/`IBisGame`. Marketplace remains a supported non-game consumer of public catalog, checkout, context and UI exports; those APIs do not authorize games to bypass the facade or access its private wallet controllers.

`src/client/marketplace-layer` contains application composition and catalog presentation. `src/client/inventory-layer` handles inventory presentation, while `src/client/account-layer` groups Account integration. `src/client/ui-layer-react` owns Marketplace styles and artwork. The application entry is `src/main.tsx`, and `public/catalog.json` supplies the public configuration loaded by the browser. Changes to production wallet behavior belong in the integration package rather than duplicated Marketplace services.

Run `npm run dev` from the repository root and open the printed `/marketplace/` URL. The default server port is `5174`; one Vite instance also serves Admin, onboarding, and integration documentation. Prefer the printed address when the launcher uses a different local port. Public catalog requests must remain under the Marketplace base rather than falling through to another application's HTML.

Run `npm run typecheck` and `npm test` for workspace checks, and `npm run build --workspace @bis/marketplace` for the application build. The production base remains `/blockchain-integration-service/marketplace/`. Automated catalog and interface tests do not, by themselves, prove that a funded trade completed on a live network; record that acceptance separately.
