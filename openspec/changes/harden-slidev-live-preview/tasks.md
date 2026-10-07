# Tasks

## 1. Define the declared preview inventory

- [x] 1.1 Add a versioned manifest for every supported local Slidev preview, including script, source entry, port, base route, landing visibility, and editor owner; verify schema validation rejects missing, duplicate, and conflicting declarations.
- [x] 1.2 Add manifest-to-package, landing-link, and proxy preflight checks; verify the current declared inventory passes and each deliberate mismatch reports its exact route or entry.
- [x] 1.3 Add inventory fixtures and unit tests for route normalization, duplicate ports, editor ownership, and unsupported script declarations; verify the test suite runs without starting author decks.
- [x] 1.4 Document the manifest as the sole supported method for adding or removing a live preview; verify all documented inventory fields map to real runtime behavior.

## 2. Build the owned runtime supervisor

- [x] 2.1 Create the Node live-preview supervisor and per-session ownership ledger under `output/logs/slidev-landing/`; verify it starts the declared inventory without opening an external terminal window.
- [x] 2.2 Implement process identity, descendant ownership, and safe port-conflict classification; verify an unrelated listener is never terminated and a project-owned stale child is recoverable.
- [x] 2.3 Implement per-service state transitions, bounded backoff, landing-first recovery, and targeted process restarts; verify injected deck and landing exits recover within 60 seconds while unaffected listeners retain their process ids.
- [x] 2.4 Add unit tests for state transitions, restart limits, deadline expiry, and ownership decisions, and document the status vocabulary; verify the tests and documented status command succeed.

## 3. Derive launcher routing and safe editor transport

- [x] 3.1 Generate or configure all launcher deck proxies from the manifest while preserving existing shared-origin URLs and WebSocket forwarding; verify every declared base route loads through port 3032.
- [x] 3.2 Route root-relative Slidev editor requests to the deck identified by the active proxied route and retain no-cache response headers; verify saves from each declared editor route reach only its owning fixture source.
- [x] 3.3 Preserve navigation-state acknowledgement guards separately from source-save routing; verify navigation posts do not change source hashes and editor fixture posts remain writable.
- [x] 3.4 Add proxy/editor integration tests and update local preview documentation; verify the tests exercise both successful responses and wrong-owner rejection diagnostics.

## 4. Add layered readiness and status reporting

- [x] 4.1 Implement direct-document, proxied-document, Slidev-marker, and browser HMR-WebSocket readiness probes for each declared service; verify a document-only fake readiness response cannot pass the full probe.
- [x] 4.2 Add a read-only local status endpoint and command exposing the session deadline, service state, owned process, latest probe, recovery count, and blocking conflicts; verify status contains no author content or request bodies.
- [x] 4.3 Capture structured, non-secret per-session events and failure references under `output/`; verify status points to the relevant artifact for an injected route and connection failure.
- [x] 4.4 Document startup, status, recovery, and port-conflict workflows; verify the documented commands work with the no-window host adapter.

## 5. Verify source, generated module, and rendered route coherence

- [x] 5.1 Implement read-only slide enumeration and normalized editor-record fingerprints for every declared deck; verify source changes during a scan are retried rather than reported as false mismatches.
- [ ] 5.2 Implement Playwright inspection of generated `@slidev/slides` metadata, visible route identity, content tokens, Vite error state, and HMR connection; verify the verifier checks every slide in the master deck and all declared decks.
- [x] 5.3 Classify routing, editor, generated-module, render, HMR, and transport mismatches with deck/slide/revision evidence; verify each classifier produces a concise actionable diagnostic.
- [ ] 5.4 Add targeted deck recycle-and-recheck behavior for stale generated modules; reproduce the slide-51/slide-52 stale-module fixture and verify recovery changes no authored Markdown hash.
- [ ] 5.5 Add coherence unit and browser integration tests plus failure screenshots/reports under `output/reports/slidev-live-preview/`; verify a clean run emits a complete inventory summary.

## 6. Prove live browser editing with an isolated fixture

- [x] 6.1 Add a declared test-only Slidev fixture that is excluded from the author-facing landing page; verify inventory validation distinguishes it from author-facing decks.
- [x] 6.2 Implement a browser editor round-trip that saves a unique token, observes the matching generated module and visible route within five seconds, and restores the fixture in `finally`; verify before/after fixture hashes match after success and failure paths.
- [ ] 6.3 Add timeout, proxy-misrouting, stale-module, and HMR-disconnect coverage for the fixture; verify each failure reports editor and render revisions with connection evidence.
- [x] 6.4 Document the isolation guarantee and latency budget; verify the test workflow never writes an authored deck.

## 7. Provide fast, integration, and soak verification profiles

- [x] 7.1 Add package commands for fast manifest/runtime checks, complete browser integration verification, and configurable-duration soak execution; verify each command writes to a descriptive `output/` subdirectory.
- [ ] 7.2 Add controlled non-authoring failure injection for a deck listener, landing listener, HMR channel, and stale module; verify successful recovery stays within the required bounds and preserves healthy processes.
- [ ] 7.3 Implement the 12-hour soak sampler and final report covering availability, reconnects, recoveries, coherence scans, and failed-probe evidence; verify a shortened profile produces the same report structure.
- [x] 7.4 Update verification documentation with expected duration, artifact locations, and failure interpretation; verify the documented fast profile runs as written.

## 8. Migrate the no-window host and operator workflows

- [x] 8.1 Update `dev:stable-preview` and the no-window Windows Scheduled Task to invoke the new supervisor while preserving the current 12-hour session and restart semantics; verify no visible Command Prompt or PowerShell window is opened.
- [ ] 8.2 Run legacy and new supervisors in observation comparison mode, reconcile route, ownership, and recovery results, then remove the legacy runtime path after parity is demonstrated; verify rollback restores the prior host action without source changes.
- [x] 8.3 Update `slidev-server-issues.md`, Slidev README guidance, and the `slidev-run` skill with the manifest, coherence, fixture, status, and recovery workflow; verify referenced commands and paths resolve.
- [x] 8.4 Add a migration acceptance checklist for active author sessions and scheduled-task cancellation/restart; verify it preserves unsaved-source safeguards and reports any required user action.

## 9. Validate the complete live-preview contract

- [ ] 9.1 Run the complete browser integration profile against every landing link and declared preview; verify route, HMR, editor, and coherence requirements pass with no unresolved recovery.
- [ ] 9.2 Run the controlled recovery suite and inspect per-session status/evidence; verify only the failed service is recycled and every author deck source hash is unchanged.
- [ ] 9.3 Run a 12-hour stable session and retain its final summary under `output/reports/slidev-live-preview/`; verify all declared routes remain available or recover within the specified bounds.
- [ ] 9.4 Review the proposal, design, spec deltas, documentation, and verification evidence with the user before applying archive or release workflow; verify all OpenSpec tasks accurately reflect the delivered state.

## 10. Align focused author-operation skills with the stable preview

- [x] 10.1 Document `slidev-run` as the required start-or-reuse entry point before move, duplicate, edit, rename, create, linking, resynchronization, and layout operations; verify the documented workflow does not start a second preview runtime.
- [ ] 10.2 Verify the move and duplicate skills preserve complete source blocks and final route positions while the shared preview remains healthy; verify the affected proxied route returns HTTP 200 and unrelated listeners retain their ownership state.
- [ ] 10.3 Verify the remaining focused author-operation skills use manifest-declared deck ownership and report the affected deck on failure; verify none stops, replaces, or recycles a healthy supervised listener.

## 11. Evaluate a consolidated local runtime

- [x] 11.1 Investigate the installed Slidev server APIs for a manifest-routed multi-deck host; verify the result identifies supported integration points and any adapter boundaries.
- [ ] 11.2 Implement a one-server candidate only when it preserves each declared deck's source, editor owner, generated-module identity, and HMR channel; verify all declared routes and editor fixture saves remain isolated.
- [ ] 11.3 Compare the candidate with independent deck servers under targeted recovery and stale-module checks; retain the current model unless the candidate preserves unrelated routes and meets the same evidence contract.
