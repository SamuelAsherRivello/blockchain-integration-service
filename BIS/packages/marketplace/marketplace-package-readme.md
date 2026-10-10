# BIS Marketplace

[Back to the main README](../../../README.md)

`@bis/marketplace` provides Stealth & Steel catalog browsing, wallet inventory, item details, and trading through the shared Account UI. It consumes public `@bis/integration` exports; wallet and transaction rules remain in that library.

## Catalog and inventory

`public/catalog.json` contains registered games and optional public wallet addresses. Stealth & Steel has issued equipment; Rogue's Dungeon is registration-only, with no wallet or catalog. Selecting it displays an empty state without a wallet query. Public configuration alone never proves current ownership; listings require actual holdings.

Owner, game, and equipment-type filters control browsing. Shoes, Daggers, and Shields display artwork, tier, effects, and prices. Filtering never transfers ownership. Empty and unavailable results remain distinct. Registering another game does not add Admin mint definitions; issuance requires an explicit verified catalog design.

Player and Game Wallet inventories have separate view states. BIS owns the complete in-memory role/profile/network-scoped provider snapshot. Account changes, wallet operations, observed evidence, and completed trades invalidate affected entries. Eligible reads start together; the selected owner controls loading completion. Fresh snapshots are reused; expired ones trigger live reads. Failures show wallet-specific errors and Retry. Invalid or legacy metadata contributes `invalid-metadata` or `migration-required` counts, distinct from generic holdings. Marketplace caches contain no credentials, SDK errors, or transaction secrets.

Item details expose appropriate actions, identifiers, and explorer links. Artwork and descriptions never establish ownership or transaction status. Classification follows integration equipment definitions.

## Accounts and trading

Account mounts the shared BIS UI with separate player and game controllers. Listing and sales eligibility follow connected wallets and operation checks. Browsing never creates accounts or submits payments.

Buy and Sell use the integration's checkout coordination and wallet operations. Their progress can include payment, asset delivery, and reconciliation. A pending checkout is not equivalent to confirmed ownership, and an interrupted request must not be blindly resubmitted. Checkout captures the item and both wallet sessions before preparation. Replacement during balance or recipient discovery stops that gesture before submission. After submission, replacement stops further legs and suppresses old UI updates; the original journal remains subject to existing recovery and logout rules. Recovery requires matching current wallets, network addresses, and exact receipt evidence. Missing evidence leaves the original leg pending rather than authorizing a replacement.

Admin and Marketplace share BIS account namespaces on the same origin; onboarding uses separate storage. Changing development ports does not migrate wallet data. Page navigation never authorizes clearing recovery records.

## Structure and development

The promoted game boundary is `IBis`/`IBisGame`. Marketplace remains a supported non-game consumer of public catalog, checkout, context and UI exports; those APIs do not authorize games to bypass the facade or access its private wallet controllers.

`src/client/marketplace-layer` owns application composition, private checkout orchestration, and catalog presentation. `inventory-layer` owns inventory presentation; `account-layer` groups Account integration; `ui-layer-react` owns styles and artwork. Entry is `src/main.tsx`. Production wallet behavior belongs in integration.

Run `npm run dev` from the root and open the printed `/marketplace/` URL. One Vite server, normally port `5174`, also serves Admin, onboarding, and integration documentation. Catalog requests must use the Marketplace base.

Run `npm run typecheck` and `npm test` for workspace checks, and `npm run build --workspace @bis/marketplace` for the application build. The production base remains `/blockchain-integration-service/marketplace/`. Automated catalog and interface tests do not, by themselves, prove that a funded trade completed on a live network; record that acceptance separately.
