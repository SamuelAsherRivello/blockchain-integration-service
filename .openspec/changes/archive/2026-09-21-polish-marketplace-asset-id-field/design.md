## Context

Marketplace detail currently mixes a shared copyable Asset ID field with
plain-text metadata, while the integration account UI already supplies a
labeled, read-only copyable field with clipboard feedback. The change extends
that familiar interaction to the public item values without changing catalog
identity, wallet queries, or trading availability.

## Goals / Non-Goals

**Goals:**

- Reuse the established accessible label, copy action, selectable value, and
  copy-result feedback behavior.
- Give the long Asset ID a full-width contained field and lay out the smaller
  values in compact two- and three-column grids.
- Remove the unused decimals value and present the compact dialog as a square
  without an internal scroll region or bottom footer copy.
- Place the disabled Buy and Sell controls in the header's upper-right column.
- Make the reusable value-field component available through the integration
  package's public API.

**Non-Goals:**

- Changing Asset ID values, ticker, quantity, gameplay values, ownership, or
  prices.
- Adding a Marketplace trading operation, wallet side effect, or dependency.
- Altering the remaining generic metadata rows or gameplay metadata layout.

## Decisions

### Reuse the shared copyable field

Marketplace imports the existing public copyable-value field instead of
creating a second clipboard implementation. This preserves established
clipboard failure handling and accessible labels. The integration package adds
the component to its public export surface; Marketplace consumes that public
surface rather than an internal source path.

Alternative: implement a Marketplace-local icon and clipboard handler.
Rejected because it would duplicate asynchronous copy state and could diverge
from Account Details.

### Reuse the shared field for every displayed detail value

The Marketplace instantiates the shared field for Asset ID, Ticker, Quantity,
and each gameplay metadata entry. Decimals is omitted instead of rendering a
non-actionable value. This keeps label, value, copy action, and feedback
semantics identical for every public detail value.

### Keep Marketplace-specific visual sizing in Marketplace CSS

Marketplace supplies scoped field-grid classes that adjust the shared field's
typography, copy target size, spacing, and inputs for the compact detail
dialog. The detail is a fixed square, with a three-column header for artwork,
identity, and disabled actions. Its field sections remain inside the square;
the verification/status/footer copy is removed instead of creating a scroll
region. A short-viewport media rule scales the complete card without adding a
scrollbar. The shared component keeps its existing compact account
presentation.

### Use one left-aligned data-row type treatment

Each Marketplace detail field sets its own inherited type treatment once, then
has its label heading, value input, and copy control inherit it. Gameplay
values retain their semantic color but no longer center-align or switch to a
monospace face.

Alternative: modify global account field styles. Rejected because it risks
changing the existing Account Details layout.

### Make `.openspec` discovery explicit in repository guidance

`AGENTS.md` treats `.openspec/` as the first planning-home lookup and plain
`openspec/` only as generated compatibility plumbing. This prevents agents
from treating the absence of the default-named directory as a missing planning
home.

## Risks / Trade-offs

- [Clipboard permissions are unavailable] → Retain the read-only selectable
  value and show the shared manual-copy fallback feedback.
- [Long Asset IDs overflow the dialog] → Use a full-width field with the
  existing minimum-width safeguards and Marketplace-scoped typography.
- [More copyable fields make the dialog taller] → Remove decimals and footer
  copy, then use the square's dedicated header/action grid.
- [A short viewport cannot fit the square card] → Scale the complete dialog
  below the short-height threshold rather than adding a scrollbar.
- [Shared UI changes affect account screens] → Limit visual overrides to the
  Marketplace class and cover the public export through build validation.
