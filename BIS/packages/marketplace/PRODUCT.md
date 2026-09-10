# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Players and reviewers browse a read-only catalog of Stealth & Steel equipment and inspect its associated game-wallet availability and gameplay metadata.

## Product Purpose

Present the game's issued equipment catalog before play, making its public asset information and intended gameplay effects understandable without claiming a completed trading system.

## Positioning

The marketplace reads a verified nine-item catalog and can read public inventory for the published game-wallet address. It deliberately shows Buy and Sell as unavailable rather than fabricating purchase behavior.

## Operating Context

The app loads `public/catalog.json`, filters equipment by owner, game, and gameplay type, and opens a detail dialog for asset and gameplay data. The integration demo owns local verified-catalog publishing.

## Capabilities and Constraints

- React and TypeScript Vite application.
- Catalog is for Stealth & Steel shoes, daggers, and shields across three tiers.
- Inventory reads are public and read-only.
- Buying, selling, and player-owned inventory are not implemented.
- Network is Signet; availability must not be overstated when catalog or inventory data cannot be read.

## Evidence on Hand

- `src/App.tsx` contains the catalog, filters, detail dialog, and disabled trade controls.
- `public/catalog.json` is the verified catalog source.
- `tests/catalog.test.mjs` validates catalog behavior.

## Product Principles

- Show actual catalog and inventory state without inventing commerce.
- Make item gameplay effects legible at a glance and inspectable in detail.
- Keep unavailable actions visibly honest.
- Treat blockchain inventory as supporting evidence, not the whole player experience.

## Accessibility & Inclusion

Catalog filters, item cards, and the detail dialog provide labels and keyboard-accessible controls; unavailable inventory and trade states are communicated in text.
