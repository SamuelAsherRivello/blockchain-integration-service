# Design

## Context

The Google source contains 51 ordered slides. `blockchain-for-game.md` currently renders 18 slides with only selected source IDs, repeated source numbers, and paraphrased copy. The local Mondrian theme already supplies cataloged layouts and route-level verification. See `proposal.md` and the `slidev-theme-layout-contract` delta for the behavior contract.

## Goals / Non-Goals

**Goals:**

- Build a durable source manifest from the Google deck's slide number, object ID, text, table data, native-image count, and selected image treatment.
- Render the manifest as 51 ordered Slidev slides using only cataloged Mondrian layouts.
- Let automated checks detect missing, duplicate, reordered, or incompletely treated source slides before human review.

**Non-Goals:**

- Editing the Google content deck, changing its factual claims, or altering the shared Mondrian visual language.
- Adding blockchain or wallet behavior to the product.
- Treating the source deck's instructional `Todo source` text as presentation-ready copy; implementation must replace those placeholders with sourced explanations before publication.

## Decisions

### Store source identity in each Slidev slide

Each generated Slidev slide will carry `contentSlide` and `contentSlideId` frontmatter from the Google deck, plus an `imageTreatment` value when the source contains a native image. The deck order will follow the manifest rather than the prior selectively ordered outline.

This keeps the review link next to the rendered content and makes static verification possible. A separate free-form mapping document was rejected because it can drift from the deck it describes.

### Preserve text and tables; recreate explanatory diagrams

Implementation will transfer the Google source text and table values exactly enough to retain the original claims, then select an existing Mondrian layout for the composition. The one source table is slide 42 and must retain every cell value.

The default image plan is:

- `copy image`: 3, 4, 5, 7, 8, 9, 17, 18, 19, and 51.
- `reimagine image`: 10, 11, 12, 30, 31, 32, and 33.

Copy treatment protects source-specific charts, assets, and closing artwork. Reimagine treatment rebuilds explanatory loop and blockchain-structure graphics as accessible, editable Slidev content rather than depending on opaque raster screenshots. This treatment is a planning decision that implementation validates against fresh Google thumbnails.

### Verify the source manifest instead of relying on screenshots alone

The existing layout verification will gain a content-correspondence check that compares the manifest with the deck's frontmatter. It will assert 51 unique, contiguous source numbers, unique source object IDs, supported layout names, required image treatment, and the slide-42 table values. Browser review remains necessary for visual fit and copied-image fidelity.

This catches structural regressions quickly. Screenshot-only review was rejected because it cannot reliably establish source IDs, omitted table cells, or duplicate mappings.

## Risks / Trade-offs

- [Google source changes after capture] → Fetch the live outline and thumbnails during verification, record the revision ID, and fail on manifest drift.
- [Source images cannot be committed or copied] → Retain the `reimagine image` alternative and record an explicit decision for the affected slide before implementation.
- [Long source content overflows a Mondrian layout] → Prefer a supported content composition or split visual density within the same slide; do not omit source claims or silently change slide order.
- [Unresolved source placeholders produce unsupported claims] → Research the cited source before replacing each placeholder and surface missing evidence for user review.

## Migration Plan

1. Capture the current Google outline, revision ID, source mapping, and image inventory in a checked-in manifest.
2. Replace the partial Slidev deck with the 51-slide manifest-backed sequence and reuse or extend only cataloged layouts.
3. Add correspondence checks and run the existing layout contract and rendered-layout verification.
4. Review the local Slidev route against the Google deck; rollback by restoring the previous Markdown deck if the source verification or visual review fails.
