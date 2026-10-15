# Proposal

## Why

The Blockchain For Game Slidev deck requires a second visual-results pass: several source visuals need their high-resolution versions restored, key diagrams need their requested scale and position adjustments, and the full deck needs evidence-based browser review rather than structural verification alone.

## What Changes

- Replace the current substitute treatments on slides 3, 4, and 5 with the corresponding upscaled source visuals; retain both source visuals on slide 5.
- Recompose slides 14 and 15 in the slide-3 content treatment, with the requested five-item hierarchy and slide 15's nested detail.
- Increase the slides 10–12 diagrams by 30% and lower their visual position by 300 pixels, while preventing clipping at the Slidev canvas boundary.
- Recompose slide 30 with the cataloged left-image layout, using an upscaled source visual on the left and its explanatory text on the right.
- Run a Playwright-driven visual review of every rendered slide, assessing image sizing, diagram sizing, overflow, and overall composition; make targeted improvements and retain review evidence under the repository-root `output/` directory.
- Keep source metadata, route behavior, and catalog-layout mapping verifiable as the presentation visuals change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `slidev-theme-layout-contract`: Require source-visual fidelity and a repeatable whole-deck rendered review in addition to existing catalog-layout and route checks.

## Impact

- `BIS/documentation/slidev/blockchain-for-game.md`, its source-image assets, and Mondrian theme/layout styling.
- Slidev rendered-layout verification and its Playwright screenshot evidence.
- The local Blockchain For Game preview route; no wallet, Arkade, game runtime, or public API behavior.

## Unresolved Decisions

- The requested 300-pixel downward movement is measured against the 1280-by-720 Slidev canvas. Its exact diagram container geometry must be validated in the first rendered pass so the larger diagrams remain fully visible.
- The source images for slides 3–5 and 30 are not currently present in the checked-in asset directory. Implementation must obtain the authorized originals from the authoritative Google deck before claiming an upscale result.
