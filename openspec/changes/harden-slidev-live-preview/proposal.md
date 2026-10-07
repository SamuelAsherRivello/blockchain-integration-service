# Proposal

## Why

The local Slidev landing page presently depends on a launcher plus many
independent Vite processes, but its health checks prove only that an HTTP page
responds. Recent incidents showed two user-visible gaps: a deck can disconnect
before the supervisor restores it, and Slidev can serve a current editor record
while rendering a stale generated component for a different slide. Authors need
a measurable, continuously verified live-editing contract rather than a
best-effort collection of dev servers.

## What Changes

- Introduce one declared live-preview runtime inventory shared by the launcher,
  supervisor, and verification tools, eliminating independently maintained
  service lists and proxy/editor routing tables.
- Replace HTTP-only supervision with per-service ownership, readiness,
  WebSocket/HMR, and bounded-restart monitoring; keep the landing page and all
  declared deck links available for a configured 12-hour session without
  opening external terminal windows.
- Add source-to-render coherence verification that compares a Slidev editor
  record, its generated slide module, and the visible browser route for every
  declared deck slide; detect and recover a stale compiled module without
  editing author content.
- Add a safe live-editor round-trip contract using an isolated fixture or
  reversible test copy, proving a browser edit persists to source, reaches the
  correct deck, and renders within a defined latency budget.
- Surface actionable runtime status, recovery evidence, and failure diagnostics
  while retaining detailed logs and temporary test artifacts under `output/`.
- Establish automated unit, integration, browser, and configurable 12-hour
  soak verification for the runtime contract.
- Establish the existing `slidev-run` and focused slide-operation skills as the
  supported author workflow: start or reuse the supervised preview first, then
  move, duplicate, edit, rename, create, or resynchronize slides through the
  relevant focused skill without replacing the runtime contract.
- Evaluate a consolidated local runtime in which one server owns the landing
  page and all declared deck routes. It must retain per-deck source ownership,
  editor routing, HMR isolation, and targeted recovery before it can replace
  the current independently served deck model.

The phrase “no bugs” is treated as a quality objective, not a claim that can
be proved. This change instead defines the observable failure modes that must
be prevented or detected and recovered, with evidence for each run.

## Capabilities

### New Capabilities

- `slidev-live-preview`: Provides a stable, observable local multi-deck
  Slidev runtime with source-to-render coherence and safe browser editing.

### Modified Capabilities

- `slidev-theme-layout-contract`: Require declared presentation routes to be
  verified through the live-preview runtime as well as through the existing
  visual-layout contract.

## Impact

- `BIS/documentation/slidev/package.json`, launcher Vite configuration, and
  local preview inventory metadata
- Slidev supervisor, process-management helpers, health/coherence probes, and
  browser/soak verification scripts
- Landing-page runtime status and editor routing behavior
- Existing Slidev author-operation skills and their verification guidance
- `output/logs/slidev-landing/` and `output/reports/` test evidence
- Existing Slidev layout-contract specification and related documentation
