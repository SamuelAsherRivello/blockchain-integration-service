# Proposal

## Why

The BIS package export gate currently cannot complete because the required test suite fails after the Windows spawn issue is bypassed. The failures block a verified `@bis/integration` handoff to Stealth & Steel and make release/export status ambiguous.

## What Changes

- Fix the failing BIS tests observed during the package export attempt:
  - `BIS/packages/integration/tests/account-assets.test.mjs`: `Assets, Contracts and Transactions render the same titled collection, refresh control, copy field, scroll area and one Back` timed out in Vite SSR import of `AccountAssets.tsx`.
  - `BIS/packages/integration/tests/account-equipment-ui.test.mjs`: `Account Assets uses the chain icon and offers loadout controls only for recognized equipment` timed out in Vite SSR import of `AccountAssets.tsx`.
  - `BIS/packages/integration/tests/account-profiles-ui.test.mjs`: `encrypted player profiles migrate, deduplicate, select explicitly, and notify other contexts` timed out.
  - `BIS/packages/integration/tests/account-profiles-ui.test.mjs`: `Account UI does not expose saved profiles while preserving ordinary account routes` timed out in Vite SSR import of `client.tsx` / `AccountOnboarding.tsx`.
  - `BIS/packages/integration/tests/lto-public-factory.test.mjs`: `public LTO factory creates and claims by default; explicit rollback keeps recovery` failed after a long runtime.
  - `BIS/packages/integration/tests/invoice-receiving.test.mjs`: `production Receive hides deferred invoice UI and keeps address Copy and Back enabled` took about 61 seconds and should be checked for avoidable timeout pressure even if it passed in this run.
  - `BIS/packages/marketplace/tests/catalog.test.mjs`: Marketplace CSS assertion failed because the current `marketplace-redesign.css` no longer matches the expected `.catalog-grid` responsive grid pattern.
  - `BIS/packages/marketplace/tests/pending-operation-prompt.test.mjs`: pending operation prompt assertion failed because error UI now renders `CopyFieldLabel` and an error textbox instead of the older direct paragraph pattern.
  - `BIS/scripts/release-version.test.mjs`: `active published release surfaces are synchronized` expected `0.0.2` while current release metadata is `0.0.7`.
- Keep the current release/export contract intact: exports require `check:release`, tests, and build to pass before packing.
- Do not change public package behavior unless a test reveals an implementation defect against existing specs.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- None. This is a test and implementation repair against existing capabilities and release rules, so the change opts out of spec deltas with `skip_specs: true`.

## Impact

- Affected areas may include integration UI test helpers, account/profile UI loading paths, LTO factory behavior, marketplace CSS/tests, pending operation dialog tests, and release-version synchronization tests.
- No package publication, GitHub Pages release, tag, commit, or Stealth & Steel import is included in this change.
