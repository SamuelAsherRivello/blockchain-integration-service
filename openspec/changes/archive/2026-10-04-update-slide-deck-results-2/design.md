# Design

## Context

See proposal.md for motivation. The deck already uses manifest-backed source identities, cataloged Mondrian layouts, and a Playwright renderer. It has no checked-in originals for the requested source-image slides, and its current rendered-layout script verifies layout selection but not visual fit across the full deck.

## Goals / Non-Goals

**Goals:**

- Preserve the authoritative Google-slide identity and content while restoring the requested source visuals at display-ready resolution.
- Make geometry changes reviewable in the 1280-by-720 Slidev canvas rather than relying on Markdown scale values alone.
- Produce complete, repeatable visual-review evidence for every rendered deck slide.

**Non-Goals:**

- Altering Google source content, changing the shared deck route, or modifying product runtime code.
- Replacing required source visuals with unrelated generated artwork.

## Decisions

### Authoritative source captures become local display assets

Implementation will acquire the four requested source-slide visuals from the connected Google presentation, preserve their provenance in the source manifest, and create display-ready copies in the deck asset directory. This retains source fidelity; continuing to use the current bar and feature-grid substitutes would not satisfy the review feedback.

### Use cataloged layouts with feedback-specific content classes

Slides 14 and 15 will remain `mondrian-content`, the same shared treatment used by slide 3. Slide 30 will switch to the existing `mondrian-image-left` catalog layout. Feedback-specific classes will establish image bounds, nested bullet spacing, and diagram staging without duplicating layout structures in the deck.

### Diagram geometry is expressed through a staged canvas

Slides 10–12 will use a dedicated diagram-stage wrapper. The stage applies the requested 1.3 scale and 300-pixel vertical offset after the diagram’s natural sizing, while its slide-level safe region is adjusted so rendered nodes and labels remain visible. Directly increasing Mermaid’s scale option alone was rejected because it cannot guarantee the requested position or prevent clipping.

### Playwright is both the review producer and structural guard

The renderer will visit all slides at the canonical 1280-by-720 viewport, save screenshots to `output/screenshots/update-slide-deck-results-2/`, and collect geometry for images, diagrams, text, and viewport overflow. The script will fail for visible content outside the canvas or for a missing target visual; human inspection of the saved results remains the acceptance check for overall design quality.

## Risks / Trade-offs

- [Google thumbnails provide insufficient detail for the displayed source visuals] → preserve the capture and use the approved raster-upscale workflow before placing it in the deck.
- [A 1.3 scale plus 300-pixel offset overflows a 720-pixel canvas] → stage the diagrams inside an adjusted vertical region and reject a render that clips nodes or labels.
- [Whole-deck screenshots identify subjective composition issues] → inspect each produced screenshot and iterate on the affected slide before marking the review task complete.
- [Existing uncommitted deck edits belong to another thread] → retain them and make no destructive or broad formatting rewrites.

## Migration Plan

1. Capture and upscale the approved source visuals, then record their provenance and use in the deck.
2. Implement the slide-specific compositions and diagram-stage geometry.
3. Extend the renderer to collect full-deck geometry and screenshots.
4. Run source/layout checks, production build, and the full rendered review; correct identified visual defects and rerun.
