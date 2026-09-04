# Receiving implementation evidence

## Baseline (2026-09-04)

- Core: `packages/integration/src/core/context.ts` owns account navigation and public state; `account-storage.ts` encrypts account material and guards generations. Activity observation is screen-scoped and must not become the receipt supervisor.
- UI: `AccountAddresses.tsx` owns existing address fields/copy; `client.tsx` composes Receive; `overlay.css` owns package styling. Add the unavailable section separately without altering address operations.
- Demo: `App.tsx` and Admin use public production API. Existing unrelated edits in demo, lockfile, documentation, and other changes are preserved.
- Stories: D2/D3 are already restored in `documentation/User Story Diagrams.md`. D2 is planned, D3 is separate sending; A5 has separate outstanding live verification. No story IDs need reconstruction.
- Verification commands: `node --experimental-strip-types --test packages/integration/tests/*.test.mjs`, `node --test packages/integration-demo/tests/*.test.mjs`, `npm run build`, and `openspec validate add-lightning-invoice-receiving --strict`.

## Test-first unavailable slice

- Added `packages/integration/tests/invoice-receiving.test.mjs`; both tests failed before production edits (missing Core capability and missing Currently unavailable markup).
- After implementation both pass. Tests exercise immutable provider-neutral unavailable state, repeated Receive/Back navigation, unchanged addresses, disabled invoice copy and selection controls, selected No Invoice, empty invoice value, and enabled address Copy/Back.
- No adapter, invoice, payment, recovery storage, or clearing-guard implementation is included in this slice. No dependencies changed.

## Verification results

- Integration tests: 58/58 passed; demo tests: 2/2 passed. Narrow invoice tests were rerun after final spacing edits and remain passing.
- `npm run typecheck` and `npm run build` passed, including both packages. Build reports large-chunk warnings, not failures.
- Real Chromium at `http://127.0.0.1:5173/`: used an isolated browser session and a real test-only account through the production API; no recovery words were printed or captured. No funding, payments, logout, reset, or database deletion was performed.
- Opened A4 → Account → Receive through the existing demo. Real address fields were populated, address Copy enabled, invoice Copy/With Invoice disabled, No Invoice selected, invoice value empty. Back returned to Account. Re-entered Receive with the same defaults.
- Inspected the 9:16 preview at 50% and 100%. Tightened only the new section's spacing so Back fits at 100%; no horizontal overflow. Final screenshot: `output/playwright/invoice-unavailable-full.png`.
- Full live lifecycle and independent-host checks in task 6.2 remain pending; this browser check proves only the unavailable slice, not live receipt handling.
- Strict OpenSpec validation passes. Changed production source passes `git diff --check`; the whole dirty worktree has unrelated pre-existing demo whitespace warnings, left unchanged.

## Live gate: blocked (2026-09-04)

- `npm ls @arkade-os/sdk @arkade-os/swap @arkade-os/boltz-swap --depth=0` reports SDK 0.4.67, with neither swap package installed.
- [Official Boltz page](https://docs.arkadeos.com/contracts/lightning-swaps): former service unavailable and client retired.
- [Official replacement receiving page](https://docs.arkadeos.com/intents/integrate/lightning#receive-a-payment): no solver currently serves Lightning-to-Arkade; the preview solver refuses that route. Online claiming is required; offline daemon claiming is not available. The example uses net-receipt amount semantics, not the approved exact payer-amount flow.
- Consequently Signet service compatibility, exact-payer fee quoting before generation, quote validity, supported claim/recovery deadlines, and restart/idempotency guarantees for this installed version are not verified. Documentation describing a client API is not evidence of a working service. Tasks 2.1/2.2 remain unchecked and subsequent live work is blocked.
