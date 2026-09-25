# Wallet subscription verification â€” 2026-09-08

Implemented shared observation in `BIS/packages/integration/src/core/shared-wallet-observer.ts` and connected the retained account observer, Activity consumers and local-operation invalidation in `context.ts`.

## Automated evidence

- Before implementation, `node --test --test-isolation=none BIS/packages/integration/tests/wallet-subscription.test.mjs` failed for stale outgoing balance (2000 instead of 1000), two sources after Activity navigation, and unchanged asset holdings.
- The same command now passes. Expanded coverage includes pre-change reads resolving late, manual Activity refresh, later confirmations, automatic reconnect with Activity recovery and no historical receipt replay, account replacement and disposal.
- `shared-wallet-observer.test.mjs` verifies failure fan-out, cleared replay data, one replacement source, independent consumer cancellation and rejection of stopped-source callbacks.
- `node --test BIS/packages/integration/tests/*.test.mjs`: 338 passed, zero failed. Includes continuation, wallet scope, activity, asset, balance, payment notification and adapter regressions. The broader run initially caught an unnecessary hidden-view state change; it was fixed and the full core suite rerun successfully.
- `npm run build`: passed, including TypeScript and both production builds. Existing bundle-size and mixed static/dynamic import warnings remain.
- `openspec validate unify-player-wallet-subscription --strict`: passed.

## Browser evidence

Fixture: `BIS/packages/integration-demo/tests/wallet-subscription.html`, served with its isolated `wallet-subscription.vite.ts` config on localhost port 5177. The fixture injects account/history/holdings readers and cannot submit payments or open a real wallet.

Verified in the Codex browser:

1. The actual BIS Balance overlay initially displayed Total and Arkade balances of 2,000 sats.
2. Clicking Observe outgoing payment changed both to 1,000 sats without clicking Refresh Balance.
3. Opening Transactions displayed the outgoing 1,000-sat record with Sources started: 1; active: 1.
4. Opening Assets initially showed an empty list. Clicking Observe asset change added Fixture trophy, 3 base units, without clicking Refresh Assets. Sources remained 1 started / 1 active.

## Limits

No real Signet transaction was submitted for this verification. External changes are accelerated by existing SDK incoming notifications and reconciled by the existing 15-second live observation fallback; this is not a promise of instantaneous delivery of every external change.

An initial combined `npm test` run was interrupted after test-created Vite servers conflicted with the browser server's optimization cache. Browser verification was moved to a dedicated cache/config, and the complete integration-core suite passed separately. The interrupted combined run is not reported as a pass.

The checkout temporarily had missing context APIs and 28 TypeScript errors during concurrent restoration. Those APIs returned before implementation verification; the final TypeScript/build checks passed against the restored checkout. Existing unrelated changes were retained.

## Single visible payment refresh — 2026-09-08

The delayed-observer regression initially counted two Balance loading cycles for one 1,000-sat continuation. After separating foreground refresh from background observation reads, the same test counts one. Independent balance changes still update silently; manual Refresh starts an explicit loading cycle; failed background reads clear the balance to unavailable.

- `node --test --test-isolation=none --test-name-pattern='pay 1000 and' BIS/packages/integration/tests/continuation.test.mjs`: failed before the fix (2 instead of 1), passed afterward.
- Complete integration-core suite: 340 passed, zero failed.
- Production build and TypeScript: passed; existing bundle warnings remain.
- Browser fixture: Pay 1000 displayed Loading once, then 1,000 sats. After the intentionally delayed observer snapshot, the visible counter remained Payment loading cycles: 1. The observer had restarted once with only one active source. This was injected fixture data, not a real Signet payment.
