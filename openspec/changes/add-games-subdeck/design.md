# Design

## Context

The final Mondrian theme owns reusable layouts, while `template-deck-b.md` is the catalog imported by `modrian-template.md`. The documentation landing page launches declared decks through the supervised preview. Existing `FocusedLink` opens a generated `focused-link.html` route in a new tab and already supports a direct mode.

## Goals / Non-Goals

**Goals:**

- Add one theme-owned two-visual product composition and one catalog example.
- Add a standalone, declared Games Subdeck for Bitmap.Game, SHRAPNEL, and Big Time.
- Use official URLs, a captured 16:9 game image, and a selected official YouTube HD thumbnail per game.
- Retain a safe new-window path to each official game site if iframe embedding is denied.

**Non-Goals:**

- Change the Blockchain For Gaming Master Deck's existing narrative or claim these games use Bitcoin or Arkade.
- Download, redistribute, or alter game media beyond the project’s needed screenshots/thumbnails.
- Embed third-party game pages directly in the presentation canvas.

## Decisions

### Theme-owned `mondrian-product` layout

Create a layout under `themes/mondrian-final/layouts/` with title/subtitle slots and an image-only two-pane grid. Keep geometry in the layout so the catalog and content deck cannot drift. A Markdown-only grid was rejected because it would duplicate structural styling per deck.

### Local game image plus official YouTube thumbnail

Capture and store a reviewable 16:9 screenshot from each official game site under the Slidev assets directory. Use the selected official YouTube video's `maxresdefault` image for the paired thumbnail, with a documented fallback only if that HD asset is unavailable. Remote-only screenshots were rejected because assets could change or disappear between review and presentation.

### FocusedLink preserves both frame and direct destinations

Keep FocusedLink as the consistent link affordance and open its page in a new tab. The focused-link page will attempt the requested official site in its existing frame mode; when a load/embedding failure is detected or indicated, it will visibly offer the official direct URL with a new-window action. For a known incompatible source, the slide will select direct mode. Plain anchors were rejected because they do not retain the framed explanatory affordance.

### Declare the subdeck in the existing preview workflow

Add the new entrypoint and script/manifest registration following the Tease Subdeck convention, then extend landing-page navigation and layout mapping discovery. A one-off standalone server was rejected because it bypasses the repository’s shared preview and verification contract.

## Risks / Trade-offs

- Third-party pages can change iframe policy → Verify every official URL in the preview; set the individual link to direct mode when framing is not supported.
- Video search results can change → Record the selected video URL and observed view count/date in source comments or a media manifest.
- External visual media can be unavailable → Keep the project-owned screenshot and use a documented thumbnail fallback.
- Adding a layout may invalidate mapping checks → Run layout synchronization and the full contract/render checks after registration.

## Migration Plan

1. Add the layout and catalog example without removing current layouts.
2. Add and register the Games Subdeck and its media.
3. Update FocusedLink fallback behavior and verify the three official destinations.
4. Run mapping, build, and rendered-layout verification; revert by removing the isolated layout, subdeck registration, and media if needed.
