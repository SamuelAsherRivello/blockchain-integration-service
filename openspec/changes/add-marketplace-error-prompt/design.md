## Context

See `proposal.md` for motivation and `specs/pending-operation-dialog/spec.md` for the behavior contract. `PendingOperations` already owns the host-scoped backdrop, rendered dialog, inert covered content, focus containment, reduced-motion bolt styling, and terminal acknowledgement. Marketplace composes that public BIS boundary and supplies operation failures through `usePendingNotice`.

## Goals / Non-Goals

**Goals:**

- Keep loading and terminal errors in one shared BIS dialog surface.
- Make the terminal error state visually match the loading prompt's frame while reserving its body for the supplied safe error text.
- Preserve Marketplace as a consumer of the public BIS UI boundary.

**Non-Goals:**

- Change loading labels, bolt animation, acknowledgement semantics, retries, checkout recovery, or wallet behavior.
- Add Marketplace-specific dialog markup, CSS, icons, or a new dependency.

## Decisions

### Model terminal error as a variant of the shared pending dialog

The existing shared renderer will select a terminal-error content branch that uses the same dialog container and semantics, with `Error` as its title, the current safe error message in a paragraph, no bolt, and the existing OK acknowledgement.

Alternative considered: a separate Marketplace error modal. Rejected because it would duplicate the shared backdrop, focus behavior, stacking, and visual shell, and would not benefit other BIS consumers.

### Keep Marketplace state and API unchanged

Marketplace will continue to call `usePendingNotice` with its operation error. The shared component changes its rendering contract; Marketplace only receives focused coverage that its supplied failure is shown by that shared variant.

Alternative considered: expose a second Marketplace-specific error API. Rejected because terminal errors are already represented by the existing notice error field.

## Risks / Trade-offs

- [A terminal branch could inadvertently alter loading behavior] → Cover loading and error markup separately in the existing focused integration test.
- [Marketplace could reintroduce a local error treatment later] → Keep a focused Marketplace boundary test that asserts it composes the public BIS prompt instead of local dialog markup.

## Migration Plan

1. Update the shared terminal-error rendering and its focused test.
2. Extend the Marketplace composition test for the exact shared error treatment.
3. Run focused tests, workspace typecheck/build, and a Marketplace browser failure check.
4. Roll back by restoring the prior shared terminal-error branch; no state, storage, wallet, or network migration is involved.
