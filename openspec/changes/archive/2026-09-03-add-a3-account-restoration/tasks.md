## 1. Implementation prerequisites

- [x] 1.1 After a separate apply request, verify installed mnemonic and wallet APIs, creation derivation, Signet network checks, and cleanup behavior; record non-secret findings and any live infrastructure limitation in A3 verification evidence before claiming restoration works.

## 2. Validation and Arkade adapter

- [x] 2.1 Implement shared 12-word English normalization, word membership, and checksum validation using existing dependencies; verify incomplete input, invalid words, all-valid-words with invalid checksum, case/whitespace normalization, and A2-generated phrases with focused tests that never print recovery material.
- [x] 2.2 Add supplied-phrase restoration using the same identity/profile derivation and checked temporary wallet lifecycle as creation; verify same phrase yields the same public ID, invalid input makes no network request, non-Signet info is rejected, and timeout/abort/late completion releases resources.

## 3. Core account lifecycle

- [x] 3.1 Add private recovery submission and non-secret restoration state/control routing; verify public state, events, and Admin observations contain no words and active accounts cannot start replacement restoration.
- [x] 3.2 Implement connection-gated saving and immediate activation into the Account dialogue; verify network failure performs no save/event, durable success emits accountConnected once with the original ID, and save failure/uncertain commit retries reconcile without generating another identity.
- [x] 3.3 Integrate cancellation, disposal, and cross-context invalidation with existing generation-checked storage; verify Back during connection prevents late saving, save-time navigation is guarded, stale restore cannot overwrite another account or survive reset, and disposed contexts emit nothing.

## 4. Production recovery UI

- [x] 4.1 Enable Restore Account and build the numbered grid, warning, Show checkbox, local validity indicators, and Restore/Back actions; verify one-asterisk-per-character masking, initially unchecked Show, reveal/hide, hidden typing/deletion/replacement, accessible statuses, and checksum-gated submission in a real browser.
- [x] 4.2 Implement explicit clipboard population with hide-before-fill and atomic wrong-count rejection; verify successful paste, incorrect counts, permission failure, whitespace normalization, retained existing fields, and stale paste completion after navigation or newer edits using an isolated clipboard seam without exposing or altering unrelated clipboard contents.
- [x] 4.3 Connect lightning loading and error views to Core; verify duplicate submission is blocked, connection failure hides and retains the phrase for Retry, Back clears it, and successful restoration returns directly to the logged-in Account dialogue with no Continue step.

## 5. Demo and documentation

- [x] 5.1 Add the Admin Restore Account story through the production API; verify logged-out entry, saved-account routing, disabled story navigation during the flow, post-A6 enabled restoration, and unchanged empty-preview/selection behavior.
- [x] 5.2 Synchronize User Story Diagrams, design-discussion, and affected package/root documentation and current OpenSpec context during implementation; verify A3 step IDs remain stable, A3.07 reflects account-access persistence, A3.09 is the minimal Account dialogue, and balances/assets/A4 remain deferred with unperformed checks explicitly pending.

## 6. Integrated verification

- [x] 6.1 Run the repository's account tests and package/demo build commands; record results and verify A1/A2/A6 behavior remains intact, especially saved-account loading, copy format, and logout routing.
- [x] 6.2 Verify real Signet restoration of a disposable experience-created identity, durable reopening on reload/browser restart, and production/demo parity with only public IDs and pass/fail evidence recorded; arrange any real-storage logout/reset steps as user-run manual checks under repository database safety rules, and never print, save to artifacts, screenshot, or transmit recovery material to the host/demo history.
- [x] 6.3 Verify the portrait preview and an independent host with keyboard and touch-sized layouts, including green/red/neutral states, Show, clipboard denial, network failure/Retry/Back, and ordinary host interaction after closing; capture only empty or safely masked views and explicitly record any remaining verification gap.
