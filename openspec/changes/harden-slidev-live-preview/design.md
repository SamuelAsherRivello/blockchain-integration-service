# Design

## Context

See [proposal.md](./proposal.md) for motivation and the delta specifications for
the behavioral contract. Today `package.json`, the Vite launcher, and the
PowerShell supervisor each carry overlapping deck information. The supervisor
uses document-level HTTP checks, while the launcher has special root-relative
editor routing. This detects neither a disconnected HMR channel nor Slidev's
stale virtual slide-module condition.

The runtime is local development infrastructure. It must preserve the existing
shared-origin URLs, the current browser editor, the navigation-write guards,
and the user requirement that no external terminal window is opened. Temporary
evidence belongs under `output/` and author slide files must never be mutated
by a health check.

## Goals / Non-Goals

**Goals:**

- Make the declared local preview inventory the only runtime source of truth.
- Supervise independent preview processes for 12-hour sessions with precise
  ownership, bounded recovery, and human-readable status.
- Prove each source editor record corresponds to the generated module and the
  visible page, including after an edit or process recovery.
- Test browser editing safely without changing authored decks.

**Non-Goals:**

- Replacing Slidev, converting the local preview into a production host, or
  guaranteeing the absence of all future defects.
- Changing authored slide text, layouts, templates, asset mappings, or the
  existing public landing URLs.
- Killing arbitrary applications that happen to listen on a preview port.
- Using the editor endpoint as a general write API outside an isolated test
  fixture.

## Decisions

### Make a versioned preview manifest the single source of truth

Add a checked-in manifest in `BIS/documentation/slidev` that declares each
supported preview's stable id, source entry, npm lifecycle script, port, base
route, landing visibility, and editor API ownership. Derive launcher proxy
configuration, supervisor process definitions, landing-route validation, and
test discovery from this manifest. A startup preflight will compare it against
package scripts and landing links, failing on unrepresented entries.

A manifest is preferred to reverse-parsing `package.json` because port, base,
route, and editor ownership are semantic data that scripts alone cannot express
unambiguously. Continuing duplicated arrays is rejected because it already
allowed new routes and recovery behavior to drift.

### Use a Node runtime supervisor with a no-window host adapter

Implement process control, probes, status, and evidence collection in a Node
script alongside the existing Slidev scripts. It will spawn declared commands,
record a per-run identifier and child ownership ledger under `output/`, and
restart only descendants whose identity and command match the active manifest.
The existing Windows Scheduled Task remains the no-window 12-hour host adapter;
an in-app terminal may run the same script interactively.

Node is preferred over extending PowerShell because the browser probes,
manifest parsing, child lifecycle, and test implementation share the existing
JavaScript dependency environment. The Scheduled Task is retained instead of a
detached process because it survives an ephemeral assistant command without
creating a visible console. A Windows service is rejected as unnecessary
machine-wide installation and administration for local documentation preview.

### Use layered readiness rather than an HTTP-only health check

Each service state machine moves through `declared`, `starting`, `ready`,
`recovering`, `blocked`, or `failed`. Readiness includes a direct deck document,
the same page via the landing proxy, expected Slidev markers, and a browser
probe that observes an open Vite HMR WebSocket at the proxied base path. The
landing is evaluated before and after deck checks. Recovery uses bounded
exponential backoff and emits timestamps, process ids, exit information, and
the precise failed probe.

Polling only the launcher is rejected because a 200 page can conceal an absent
deck connection. Restarting the full inventory on any failure is rejected
because it interrupts healthy editing sessions and hides the affected owner.

### Establish a three-layer coherence oracle

A Playwright verifier will enumerate every slide from the owning deck's editor
API and calculate a normalized fingerprint of its content and revision. For
each slide it will load the matching proxied route, inspect the generated
`@slidev/slides` metadata after the component is loaded, confirm the component
slide number/revision/fingerprint, and require a non-error visible slide canvas
with expected meaningful content tokens when the slide has text.

The verifier will classify mismatches as routing, editor, generated-module,
render, HMR, or transport failures. On a generated-module mismatch it asks the
supervisor to recycle only that deck, waits for a fresh HMR session, and repeats
the entire affected-deck check. It never rewrites Markdown. This specifically
catches the observed case where the editor served slide 51 but Slidev's
generated component rendered slide 52.

Comparing HTTP response bodies alone is rejected because the editor API can be
current while the compiled component is stale. Screenshot-only comparison is
rejected as the primary signal because it is expensive and cannot reliably
identify content identity; screenshots remain failure evidence.

### Verify browser editing in an isolated fixture

Add a small declared test fixture deck, excluded from the author-facing landing
page. The verifier saves a unique test token through the normal browser editor,
waits for the matching route and generated metadata to show that token within
five seconds, then restores the fixture's original source in `finally` logic.
The fixture runs under an isolated test profile and retains before/after hashes
in `output/reports/slidev-live-preview/`.

Editing an authored slide and restoring it is rejected because a concurrent
author edit could be overwritten. Mocking the editor request is rejected because
it would not prove the actual proxy, Slidev parser, write, HMR, and rendering
path.

### Make status and evidence first-class outputs

Expose a read-only local status endpoint and command that report the manifest
revision, session deadline, service state, owner process, latest route/HMR/
coherence result, recovery count, and blocking conflicts. Keep structured event
logs, browser failures, and optional screenshots under a per-session `output/`
directory. Sensitive request bodies and author content are excluded; fingerprints
and diagnostic metadata are sufficient for correlation.

Console-only logs are rejected because authors need to distinguish a browser
connection issue from a failed deck, stale module, or unrelated port conflict.

### Use the existing focused skills for author operations

The established workflow starts or reuses the manifest-supervised preview with
`slidev-run`, then uses the focused skill for the requested operation. The
move and duplicate helpers already provide dry-run, authorized write, source
block preservation, and post-write structural verification. Other established
skills own content linking, template/deck resynchronization, layout
synchronization, and slide-content work. When a preview is already available,
the affected route is checked after the operation; the operation must not stop
or replace the supervisor.

Creating a second operation orchestrator is rejected because it would duplicate
the manifest, ownership, and recovery rules that the stable preview already
owns. Extending every focused helper with process management is rejected because
an authoring operation must not be able to recycle or terminate healthy decks.

### Separate fast, integration, and soak profiles

Provide unit tests for manifest validation and process ownership classification;
an integration profile that exercises every declared route, HMR, editor fixture,
and coherence scan; and a configurable soak profile whose normal target is 12
hours. The soak run samples route availability and coherence periodically,
forces controlled fixture-deck and master-deck recovery in a non-authoring test
mode, and writes one durable summary.

Requiring a 12-hour test in every commit is rejected as impractical. Omitting a
long-duration profile is rejected because the user-facing failure occurs after
process lifetimes and repeated edits, not merely at startup.

## Risks / Trade-offs

- [A browser coherence scan is slow on a large deck] → Reuse one browser per
  deck, parallelize only independent decks within a conservative limit, and
  scan the affected deck immediately after recovery.
- [A source edit arrives during verification] → Use read-only checks for author
  decks, re-read revisions before accepting results, and mark a changed slide
  for a retry rather than reporting a false mismatch.
- [A port is occupied by another tool] → Require run-id ownership evidence
  before termination and keep the service in `blocked` state with guidance.
- [The Scheduled Task is cancelled] → Detect cancellation/expiry, preserve the
  last status, and make the next stable-preview invocation recreate or resume a
  no-window session.
- [Slidev changes its virtual-module internals] → Isolate the browser adapter,
  test it against the pinned Slidev version, and report an unsupported adapter
  state instead of silently downgrading coherence coverage.

## Migration Plan

1. Add and validate the manifest in check-only mode against the current
   package, launcher, and landing inventory.
2. Implement the Node supervisor and status contract alongside the existing
   PowerShell script; run both in observation mode and compare evidence.
3. Move the Scheduled Task and `dev:stable-preview` entry to the new
   supervisor, retaining a documented rollback command for the old script.
4. Add the browser HMR, coherence, and isolated editor-fixture verifiers;
   reproduce the stale-module scenario in a controlled test and prove targeted
   recovery.
5. Run fast verification, the complete integration profile, and a 12-hour soak
   session before retiring the legacy supervisor implementation.

Rollback restores the prior script and task action together, removes the new
status route, and leaves author decks and source untouched. Generated output
artifacts are not part of rollback or version control.

## Open Questions

- The exact default concurrency for full-deck browser scans can be tuned after
  measuring this repository's 80-slide master deck; it does not alter the
  behavioral contract or task breakdown.
