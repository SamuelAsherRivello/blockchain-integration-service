# Proposal

## Why

The presentation currently explains blockchain-game concepts without a compact, reusable way to show a real game's visual experience alongside its most-viewed official video. A cataloged product composition and a dedicated Games Subdeck will make those examples reviewable and consistently linkable.

## What Changes

- Add a reusable `mondrian-product` Slidev layout and a `product-layout` catalog example with a title, subtitle, and two equal columns. Each column has a FocusedLink label above a 16:9 image: `Website` for the official-game screenshot and `YouTube` for the official-video thumbnail.
- Add a Games Subdeck containing one product slide for each previously selected example: Bitmap.Game, SHRAPNEL, and Big Time.
- Populate each slide with an official gameplay screenshot and the HD thumbnail from the selected official YouTube video. The Website and YouTube FocusedLink labels, and their respective images, open their matching destinations in a new tab.
- Update the focused-link flow to attempt the official site in its framed experience and offer a direct new-window destination when embedding is blocked.
- Register the subdeck in the shared Slidev preview and verification workflow.

## Capabilities

### New Capabilities

- `slidev-game-showcase`: A reusable, linked visual product showcase for blockchain-game examples.

### Modified Capabilities

- `slidev-theme-layout-contract`: The Mondrian layout catalog and declared content decks gain the reusable product composition and Games Subdeck route.

## Impact

- Affected sources: Slidev theme layouts/styles, template deck, documentation landing/preview configuration, and a new Games Subdeck with locally managed reviewable media references.
- Affected component: `FocusedLink.vue` and its framed-link page behavior.
- No runtime BIS wallet, Arkade, or package API changes.
