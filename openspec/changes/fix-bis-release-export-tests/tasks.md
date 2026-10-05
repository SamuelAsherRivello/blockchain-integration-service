# Tasks

## 1. Failure Reproduction

- [ ] 1.1 Re-run the focused failing BIS tests from the proposal and verify which failures reproduce outside the earlier full-suite run.
- [ ] 1.2 Inspect `git status --short` in BIS before code edits and verify unrelated dirty work, especially `BIS/packages/marketplace/src/marketplace-redesign.css`, is identified and preserved.

## 2. Release Version Test Repair

- [ ] 2.1 Repair `BIS/scripts/release-version.test.mjs` or its test fixture so `active published release surfaces are synchronized` accepts the current synchronized `0.0.7` release surfaces, then verify `node --test BIS/scripts/release-version.test.mjs` passes.
- [ ] 2.2 Verify `npm.cmd run check:release` still passes and still rejects unsynchronized release surfaces.

## 3. Marketplace And Pending Dialog Assertions

- [ ] 3.1 Repair the Marketplace catalog CSS assertion or implementation so the test protects the spec-required responsive public catalog behavior without depending on stale formatting, then verify `node --test BIS/packages/marketplace/tests/catalog.test.mjs` passes.
- [ ] 3.2 Repair the pending operation prompt test or implementation so terminal errors retain safe contextual text, Copy support, and OK acknowledgement, then verify `node --test BIS/packages/marketplace/tests/pending-operation-prompt.test.mjs` passes.

## 4. Integration UI Timeout Failures

- [ ] 4.1 Diagnose and fix the `AccountAssets.tsx` Vite SSR timeout affecting account asset collection and equipment UI tests, then verify `node --test BIS/packages/integration/tests/account-assets.test.mjs BIS/packages/integration/tests/account-equipment-ui.test.mjs` passes.
- [ ] 4.2 Diagnose and fix the account profiles UI timeout affecting profile migration and route exposure tests, then verify `node --test BIS/packages/integration/tests/account-profiles-ui.test.mjs` passes.
- [ ] 4.3 Diagnose and fix the `AccountOnboarding.tsx` / `client.tsx` Vite SSR timeout if it remains distinct from the profiles fix, then verify the focused account profiles UI command remains passing.

## 5. LTO And Slow Receive Checks

- [ ] 5.1 Diagnose and fix `public LTO factory creates and claims by default; explicit rollback keeps recovery`, then verify `node --test BIS/packages/integration/tests/lto-public-factory.test.mjs` passes.
- [ ] 5.2 Re-run `node --test BIS/packages/integration/tests/invoice-receiving.test.mjs` and either verify `production Receive hides deferred invoice UI and keeps address Copy and Back enabled` completes without new failure or document that it is slow but passing without changing behavior.

## 6. Export Gate Verification

- [ ] 6.1 Run `npm.cmd test` and verify the full BIS suite passes outside the sandbox `spawn EPERM` failure mode.
- [ ] 6.2 Run `npm.cmd run build` and verify the production build succeeds.
- [ ] 6.3 Run `git diff --check` and verify changed files have no whitespace errors.
- [ ] 6.4 Confirm no package export, Stealth & Steel import, commit, push, tag, or publication was performed by this repair change.
