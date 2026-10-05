## Why

Related account screens repeat presentation and interaction code, so small changes can diverge: Set Recovery Phrase and Get Recovery Phrase recently required a follow-up fix because only one heading received the shared row layout. A review of the runtime and demo UI identified concrete opportunities to consolidate components without changing wallet behavior or redesigning the interface.

## What Changes

- Extract one private recovery display for Set Recovery Phrase and Get Recovery Phrase, retaining their distinct acquisition, Continue, Back and cleanup behavior. Share the seed-word heading, warning and visibility control with Restore Account while retaining its editable, validated grid.
- Consolidate copy/paste/visibility icon presentation, field heading layout, read-only copyable values and React clipboard-write lifecycle handling. Preserve caller-specific messages, exact exported content and recovery copy's persistent success indicator.
- Extract common Send/Transfer review rows and quote-expiry timing while keeping their operation controllers, validation, Max and submission guards separate. Retain existing AmountChooserRow and AccountBalances reuse.
- Separate account card presentation and recovery rendering from client.tsx without changing navigation, public APIs, focus destinations or pending-operation registration.
- Consolidate demo story-action markup locally. Preserve the runtime/demo ownership and style boundary; keep their distinct modal implementations and specialized list/detail behavior.
- Migrate shared CSS with its components and remove only branches/selectors proven unused by the affected production and test consumers. Add focused behavior and layout regression coverage, and record known stale fixture/spec expectations.

## Capabilities

### New Capabilities

None. This is an internal component refactor; no new player or host capability is introduced.

### Modified Capabilities

None. Existing behavior and the user's already-confirmed recovery titles, masking and icon alignment are the baseline. `skip_specs: true` explicitly omits delta specs. Historical specification drift is documented in design.md; this change does not silently rewrite old requirements or adopt unrelated active proposals.

## Impact

Primary scope: packages/integration/src/ui and its isolated browser fixtures. Secondary scope: packages/integration-demo/src/admin/AdminPanel.tsx and corresponding demo tests. The design inventories every current runtime/demo UI source area and records where reuse is appropriate or intentionally deferred.

No public package exports, new dependencies, SDK changes, storage changes, network operations, transaction semantics or new UI theme are proposed. Integration primitives remain private to packages/integration; the demo continues to consume the public API. Existing uncommitted recovery UI edits are retained as the baseline. Coordinate overlapping Send, Transfer, invoice and browser-state work without implementing their outstanding functionality.
