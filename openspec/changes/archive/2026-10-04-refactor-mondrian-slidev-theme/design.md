# Design

## Context

See [proposal.md](proposal.md) for motivation. The current template entry point delegates to `template-deck-b.md`, while `blockchain-for-game.md` independently selects generic layouts such as `section`, `default`, and `two-cols`. Both use `themes/mondrian-final`, but `styleSlide` is currently supplemental metadata rather than a layout contract.

## Goals / Non-Goals

**Goals:**

- Make the local Mondrian theme the only owner of reusable composition, spacing, responsive behavior, animation, and shared interactive-image rules.
- Make the template deck a reliable visual catalog for every layout that content decks can choose.
- Make the Blockchain deck a Slidev Markdown content deck that uses the same named theme layouts through frontmatter and slots.
- Preserve existing content, deck routes, and intended visual variants while eliminating metadata-only style claims.

**Non-Goals:**

- Directly inherit one Slidev Markdown deck from another; Slidev does not support that runtime model.
- Change blockchain integration behavior, package APIs, or presentation content meaning.
- Introduce a new third-party presentation framework or dependency.

## Decisions

### Use a local Slidev theme as the source of truth

`themes/mondrian-final` will remain a local Slidev theme and will own named Vue layouts plus shared CSS/components. This follows Slidev's theme and layout extension points, so a layout fix propagates to every deck that selects it.

Alternative considered: copy template Markdown into the content deck. Rejected because copied markup drifts and is not a reusable Slidev composition.

### Model catalog entries as named layouts

The catalog will expose named layouts for the current reusable variants: intro, section/subsection, ordinary content, two-column, two-column-header, diagram, image, logos, about, and end. Template deck examples will use these exact names; content slides will declare one of them in frontmatter.

Alternative considered: continue mapping numeric template pages through `styleSlide`. Rejected because a page number is not a Slidev layout contract and cannot guarantee rendered parity.

### Keep content in deck Markdown and structure in layouts

The Blockchain deck will retain headings, body content, image references, and named-slot content. Layout components will own visual framing, positioning, responsive rules, and reusable behavior. Any audit metadata will reference the selected layout name and its catalog example.

Alternative considered: encode full HTML and CSS in each content slide. Rejected because it duplicates theme structure and defeats layout reuse.

### Validate both source and rendered contracts

Implementation will check that every cataloged layout is rendered by the template deck and that every Blockchain slide selects that same cataloged layout under the custom Mondrian theme. Browser verification will compare every mapped content slide against its catalog counterpart, then confirm the landing page exposes both local preview routes for human approval.

### Define failing conditions before approval

The local approval check will explicitly fail when a Blockchain slide selects an uncataloged layout or a theme other than the custom Mondrian theme. A passing build or HTTP response alone is insufficient; the complete deck-to-catalog mapping and both theme declarations must pass before human approval is requested.

## Risks / Trade-offs

- [Some catalog slides rely on inherited generic Slidev layouts today] → Replace or wrap them with explicit Mondrian theme layouts before exposing them to the content deck.
- [Existing page-number references can shift when template entries change] → Use stable layout names for the runtime contract and retain page links only as generated review metadata.
- [Rich variants such as logos and diagrams have bespoke content needs] → Define documented slots and frontmatter inputs for each instead of allowing unstructured per-slide CSS.
- [Migration can alter visual output] → Capture representative screenshots and compare catalog/content routes before accepting the refactor.
- [A page can load while violating the shared-layout contract] → Treat every uncataloged layout or non-Mondrian theme declaration as a verification failure, not a warning.

## Migration Plan

1. Inventory template catalog entries and the layouts used by the Blockchain deck.
2. Add or normalize named layouts and slot contracts in the local Mondrian theme.
3. Update the template deck to exercise each layout as the canonical catalog.
4. Migrate Blockchain slides to the corresponding named layouts while preserving their content.
5. Replace numeric-only review metadata with layout-aware audit references.
6. Build and browser-verify both decks, all slide-to-catalog mappings, and the landing-page links used for human approval.

Rollback is a Git revert of the refactor; no persisted data or public API migration is involved.
