## 1. Implementation after a separate apply request

- [ ] 1.1 Wire the runtime burn action to the existing toast entry point and emit one info pending message after OK and one success confirmed message on burned; verify immediate and delayed outcomes preserve order and Cancel/Escape emits neither a request nor toast.
- [ ] 1.2 Separate burn progress and burn-origin holdings/image preparation from pending-overlay registration while retaining ordinary Assets loading and local in-flight guards; verify delayed submission and refresh show no covering dialog and duplicate clicks submit once.
- [ ] 1.3 Preserve acknowledgment-required burn/unknown/refresh error handling and account lifetime checks; verify unknown outcomes never emit confirmed, refresh retries reads only, and stale callbacks enqueue nothing for a replacement account.

## 2. Integrated verification and documentation

- [ ] 2.1 Update account-assets-host and pending-operation-host production UI fixtures for the new flow, including Are you sure?, fast success, failure, unknown outcome, slow refresh, image fallback and refresh failure; verify in a real browser that confirmation remains, both typed toasts appear and the runtime stays interactive during progress.
- [ ] 2.2 Run focused burning, account-assets and toast tests plus the repository's applicable type/build checks; record actual results and any unrelated baseline failures under output/reports/burn-toasts/ without submitting a live burn.
- [ ] 2.3 Update the integration and integration-demo README burn/pending descriptions and append the superseding burn presentation decision to design-discussion.md; verify wording retains confirmation, truthful success semantics and recovery protections.

## 3. User-requested asset observation

- [ ] 3.1 Subscribe to SDK wallet output events while Assets is open, coalesce background reads, remove activity-driven asset polling, and clean up on exit; verify event types, idle silence, burst coalescing and late-callback isolation with focused tests.
