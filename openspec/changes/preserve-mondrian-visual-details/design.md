# Design

## Context

See [proposal.md](proposal.md). The current template Markdown and Mondrian theme already contain partial implementations of the requested visual details, but the requirements are not separately testable or isolated from the theme-architecture refactor.

## Goals / Non-Goals

**Goals:**

- Convert each approved visual decision into a rendered acceptance check.
- Keep the checks independent of presentation slide numbering where a removed slide changes numeric positions.
- Preserve image-link accessibility while removing text-link decoration from image-only controls.

**Non-Goals:**

- Refactor the local Slidev theme or migrate the Blockchain deck to named layouts.
- Change presentation content, asset ownership, or external link destinations.
- Start implementation of these visual adjustments during this planning change.

## Decisions

### Test rendered behavior rather than source-line details

The acceptance checks will inspect the rendered template deck for geometry, focus treatment, and animation order. This prevents a theme refactor from passing merely because a selector still exists in a stylesheet.

Alternative considered: assert only CSS declarations. Rejected because an equivalent implementation can use different selectors and because source rules do not prove an element receives the expected treatment.

### Treat the XP composition as a named visual target

The visual requirement will target the Game XP composition rather than relying on its current numerical slide position. This keeps the requirement valid after the former slide-nine composition is removed.

Alternative considered: retain a fixed slide number. Rejected because it makes a correct catalog sequence appear to fail when slide numbering changes.

### Keep accessibility in the image-link acceptance check

Removing underline-like decoration will not remove `focus-visible` feedback. The rendered check will cover both conditions together.

Alternative considered: test only the absence of decoration. Rejected because that could regress keyboard navigation.

## Risks / Trade-offs

- [Pixel-sensitive comparisons can be brittle across viewport sizes] → Fix the approval viewport and assert computed geometry/timing where possible.
- [Remote thumbnail images can make visual checks flaky] → Test link treatment against locally packaged logo assets and avoid using remote-image load completion as a pass condition.
- [The theme refactor can alter the same source files] → Apply this change only after the structural refactor has passed its own catalog/deck contract checks.

## Migration Plan

1. Complete and approve the named-layout theme refactor first.
2. Implement the visual-preservation checks and any narrowly scoped theme corrections.
3. Run the catalog build and rendered verification at the fixed approval viewport.
4. Keep this change reversible with a Git revert; no persisted data is affected.
