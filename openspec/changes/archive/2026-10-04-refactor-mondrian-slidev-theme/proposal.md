# Proposal

## Why

The Mondrian template deck and the Blockchain For Game deck currently share a theme but independently choose generic layouts. `styleSlide` therefore acts as a review label instead of a guarantee that a content slide uses the corresponding Mondrian composition, allowing the two decks to drift apart.

## What Changes

- Establish `themes/mondrian-final` as the single local Slidev theme that owns the reusable Mondrian layouts, components, and visual rules.
- Treat `modrian-template.md` as the canonical visual catalog and regression deck for every supported theme layout, rather than as a deck another Markdown file directly inherits from.
- Rewire `blockchain-for-game.md` so every slide selects a named layout supplied by the same local theme and supplies only its slide-specific content through Slidev Markdown and slots.
- Replace metadata-only style mappings with an auditable mapping from each content slide to its actual shared layout and matching template example.
- Preserve existing content and supported routes while migrating the current intro, section/subsection, content, two-column, two-column-header, logo, about, and end variants.

## Capabilities

### New Capabilities

- `slidev-theme-layout-contract`: Defines the shared local Slidev theme, its catalog deck, and the requirement that content decks render through the theme's named layouts.

### Modified Capabilities

- None.

## Impact

- Affected sources: `BIS/documentation/slidev/themes/mondrian-final/`, `BIS/documentation/slidev/modrian-template.md`, `BIS/documentation/slidev/blockchain-for-game.md`, and associated preview/build configuration.
- No runtime API, blockchain, wallet, or package dependency changes are planned.
- The implementation will use Slidev's documented local-theme, layout, frontmatter, and slot mechanisms.

## Definition of Done

- One Modrian Template deck showcases every custom layout supplied by the custom Mondrian Slidev theme.
- One Blockchain For Gaming deck contains its required content and directly selects the custom Mondrian theme and its named custom layouts through Slidev frontmatter.
- The local landing page hosts navigable Modrian Template and Blockchain For Gaming preview routes for human approval.
- Verification fails if one or more Blockchain For Gaming slides select a layout that is not showcased by the Modrian Template deck, or if one or more slides use a theme other than the custom Mondrian theme.
