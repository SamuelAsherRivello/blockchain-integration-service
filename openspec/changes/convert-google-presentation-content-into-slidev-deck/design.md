# Design

## Context

The live Google deck, currently at 51 slides, provides source order, Google object IDs, text, tables, and visual references. The existing Slidev deck has 18 partial slides and the local Mondrian theme already provides cataloged layouts and verification. See `proposal.md` and the spec delta for the conversion contract.

## Goals / Non-Goals

**Goals:**

- Capture a checked-in source manifest containing the Google revision ID, all 51 source identities, text, table data, and image treatment.
- Render a 51-slide Slidev deck with editable layouts, tables, and diagrams where the source uses a screenshot or an explicitly replaced visual.
- Make source correspondence and visual treatment mechanically verifiable before browser review.

**Non-Goals:**

- Editing the Google source deck or adding wallet, Arkade, or game-runtime behavior.
- Copying source images that the user directed to omit.
- Presenting the Google deck's `Todo source` placeholders as final claims.

## Decisions

### Manifest-backed source mapping

The conversion will build a source manifest from the connected Google deck and place each source number and object ID in the corresponding Slidev frontmatter. The manifest records the source revision so verification detects reordered, added, removed, or remapped slides. The newly added source slide 43 uses object ID `h5a9ba4b51e017a3d_3_0`.

Embedding the identity in each slide avoids a separate mapping document drifting from the rendered deck.

### Editable tables replace selected source visuals

Slides 7 and 8 will recreate the Web and Games three-generation tables with editable title, row header, and column header text. Their body-cell visuals will use copied assets at 4×. Slide 9 will recreate the Approach table entirely with editable text cells.

Slides 42 and 43 will use an editable 4-by-3 table composition. Slide 42 remains a general Bitcoin Layers comparison. Slide 43 reuses the visual grammar but changes the content and layout as needed for game relevance. Native Slidev/HTML table content is preferred over an image because it permits review and later edits.

### Shared Mermaid building blocks

Slides 20–27 use a new cataloged `right-diagram` layout with left bullets and right Mermaid content. Slides 31–33 use one reusable network topology with line-color variants: white for decentralization, gold for transparency, and gold plus a red blocked path for immutability. Slide 37 renders the BIS capability map as Mermaid.

Slides 10–12 use custom game-loop diagrams. Slides 10 and 12 contain no image; slide 11 includes a separately reimagined Pac-Man, pellets, and ghost visual. Mermaid maintains diagram editability; generated or permitted artwork supplies only the reimagined game characters.

### Image policy and asset resolution

Every source image is explicitly marked `copy image`, `reimagine image`, or `omit image`. The conversion omits native source images on slides 10, 12, and 17–19. Copied logos and table-cell assets are upscaled 4×; larger charts and full-slide artwork are upscaled 2×. The manifest records this category so checks can enforce it without relying on a render-size heuristic.

## Risks / Trade-offs

- [The live source deck changes mid-conversion] → Capture its revision ID, refresh the manifest before review, and fail verification when identities or order drift.
- [Copied assets become large] → Apply the agreed 2×/4× policy only to approved copied assets and measure the built deck size.
- [Mermaid cannot express a source composition cleanly] → Preserve the explanatory relationship with Mermaid plus Slidev layout content rather than reverting to a screenshot.
- [Source placeholders lack evidence] → Research the cited Lightning, Liquid, Taproot, and Ark references before replacing any placeholder copy.

## Migration Plan

1. Capture the live Google source manifest and selected high-resolution assets.
2. Add the `right-diagram` catalog layout and reusable Mermaid building blocks.
3. Replace the partial Markdown deck with 51 manifest-backed slides, custom tables, and approved image treatments.
4. Run structural verification, build the deck, and compare all rendered slides against fresh Google thumbnails.
5. Restore the prior Markdown deck if mapping or visual verification fails.
