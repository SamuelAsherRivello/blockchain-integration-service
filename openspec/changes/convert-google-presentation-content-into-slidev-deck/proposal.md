# Proposal

## Why

The live Google content deck is the authoritative presentation source and now contains 51 slides, while the local Slidev deck is a smaller, paraphrased subset. The local deck needs a one-to-one, reviewable conversion that keeps the source's information while using editable Slidev layouts, diagrams, and tables.

## What Changes

- Convert the 51 Google source slides into an ordered Blockchain For Game Slidev deck, retaining each source number and object ID in slide metadata.
- Transfer source text and table information without changing the source claim; replace source visual screenshots with the confirmed custom diagrams and editable tables where directed.
- Add a cataloged `right-diagram` layout for slides 20–27, with source-aligned bullet copy on the left and a Mermaid diagram on the right.
- Create editable tables: logo-cell tables for slides 7–8, a text-only table for slide 9, a general Bitcoin Layers table for slide 42, and a game-oriented counterpart for slide 43.
- Create custom Mermaid diagrams for slides 10–12, 20–27, 31–33, and 37. Slide 11 includes a reimagined Pac-Man, pellets, and ghost; slides 31–33 share the network structure with white, gold, and gold-plus-red line treatment.
- Apply the confirmed source-image policy: copy only approved source imagery, intentionally omit images on slides 10, 12, and 17–19, and upscale all copied raster assets adaptively by 2× to 4× before use.
- Verify source correspondence, source metadata, table content, diagram treatment, image treatment, asset resolution, and Slidev route availability.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `slidev-theme-layout-contract`: Define complete Google-source correspondence, editable conversion rules, the new right-diagram layout, and auditable image, table, and diagram treatments for the Blockchain For Game deck.

## Impact

- `BIS/documentation/slidev/blockchain-for-game.md`, the Mondrian theme catalog, and its verification scripts.
- Local documentation launcher and the existing `/slidev/blockchain-for-game/` preview route.
- No wallet, Arkade, game-runtime, or public API behavior.
