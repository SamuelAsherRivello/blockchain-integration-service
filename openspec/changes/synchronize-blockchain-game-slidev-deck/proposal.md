# Proposal

## Why

The local Blockchain For Game Slidev deck currently contains 18 slides and only partial, paraphrased coverage of the 51-slide Google source deck. Its `contentSlide` metadata also repeats and skips source slide numbers, so reviewers cannot establish a dependable slide-by-slide correspondence.

The source deck is now available through the connected Google Slides integration. This change makes that deck the auditable content baseline while preserving the repository's shared Mondrian Slidev presentation system.

## What Changes

- Replace the partial deck outline with one ordered Slidev slide for each of the 51 Google content-deck slides.
- Preserve each source slide's number and Google object ID in reviewable metadata so the correspondence remains one-to-one and in source order.
- Transfer source text, editable tables, and meaningful diagrams without paraphrasing their claims or leaving the source deck's `Todo source` placeholders as presentation copy.
- Record an image treatment for every source slide: copy source raster assets when the original visual is material evidence or branding, and reimagine explanatory graphics as accessible Slidev-native compositions when they can be recreated without losing meaning.
- Extend the content-deck verification so it checks count, ordered source mapping, text coverage, image-treatment declaration, shared-layout use, and the established local preview route.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `slidev-theme-layout-contract`: Require the Blockchain For Game deck to retain an auditable, ordered correspondence with every Google content-deck slide, including content and image treatment, in addition to its existing layout mapping.

## Impact

- `BIS/documentation/slidev/blockchain-for-game.md` and its content or asset references.
- Mondrian layout catalog and Slidev verification scripts, if the 51-slide source requires supported compositions that the catalog does not yet cover.
- The local documentation launcher and `http://localhost:3032/slidev/blockchain-for-game/` preview route.
- No wallet, Arkade, game-runtime, or public API behavior.
