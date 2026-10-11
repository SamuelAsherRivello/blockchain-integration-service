# Verification

Verified 2026-10-11 on main, coordinated after checkpoint d138e3a. Root runner-only commits through 2736dce are disjoint. No package installation, version change, private wallet access, signing, live mutation, or shared-server restart was performed.

## Behavior and spec audit

| Requirement | Implementation and evidence |
| --- | --- |
| Early address projection | Existing role slot derives addresses through public SDK primitives from its own identity and validated operator configuration. Exact Arkade/boarding parity against normal SDK wallet creation covers both networks and timelock boundaries. One bootstrap configuration promise and one wallet factory remain shared. Later configuration reads are fresh. |
| Lifecycle isolation | Focused tests cover independent cancellation, retirement, replacement, network change, disposal, A-B-A generations, failed configuration, and invalid full-wallet setup. Presentation cannot authorize ownership or signing. |
| Independent labels | Player uses prepared addresses; Game address appears independently of catalog. Profile/network-scoped display replaces the module global. Duplicate Game refresh is removed. Slow/offline/mismatched configuration and isolated logout show truthful states. Existing inventory/cache/readiness regressions pass. |
| Sub-second acceptance | Browser observer records only the exact expected selected addresses derived separately through the normal SDK. Cold navigation and reload pass with configuration delayed 250 ms, ownership reads 5,000 ms, and catalog 2,000 ms. |

## Results

- Focused Node suites: **105/105 passed** across address projection, app wallet sessions, prepared addresses, wallet readiness races, wallet labels, catalog, network selection, and inventory cache.
- `npm run typecheck`: passed.
- `openspec validate accelerate-marketplace-wallet-labels --strict`: passed before sync/archive.
- Both synced main specs passed strict validation. Only existing Marketplace long-requirement informational hints were reported. Exact delta-body inclusion and absence of delta operation headers were checked before CLI archive with `--skip-specs` (sync had already completed). Apply tracking reported all six tasks done at source lines 5, 6, 10, 11, 15, and 16.
- Playwright against shared 5174: **2/2 passed**, cold Player **899.9 ms**, Game **908.1 ms**; reload Player **678.4 ms**, Game **707.5 ms**.
- Default self-hosted browser acceptance: **2/2 passed**, cold Player **908.6 ms**, Game **916.5 ms**; reload Player **770.5 ms**, Game **778.1 ms**. The test warms only the test-owned Vite compilation graph in a separate context; the measured context has a cold browser cache and no initialized wallet. Both runs used Chrome, four configuration requests across two roles/two navigations, zero mutations, and zero page errors.
- Live public-provider diagnostic with isolated public BIP39 vectors: cold Player **740.9 ms**, Game **723.9 ms**; reload Player **555.6 ms**, Game **544.2 ms**. Observed configuration response durations were **104.1–147.5 ms**. Non-GET requests were blocked; none were attempted; no page errors occurred.
- Cached `playwright-cli` inspected the real shared Marketplace route, rendered guest labels, catalog response, and console: **zero errors or warnings**. Only this task's browser session was closed.

The earlier controlled cold Player result of **1,044.2 ms** failed the criterion. Starting the single configuration request alongside key derivation removed the serial wait; the passing results above follow that change. No timing threshold was relaxed. These are observed local Chrome results with stated provider conditions, not an unconditional remote-network SLA or a measurement of the user's private wallets. Slow/failing operators retain Loading/Unavailable; labels do not establish transaction readiness.

Ignored evidence lives under `output/logs/marketplace-wallet-labels/`, `output/reports/marketplace-wallet-labels/`, and `output/playwright/marketplace-wallet-labels/`. The final self-hosted run updates `cold-label-timing.json`; live evidence is separate. No temporary evidence is committed.

## Stable handoff scope

Production files:

- `BIS/packages/integration/src/client/state-layer-core/context.ts`
- `BIS/packages/integration/src/client/wallet-layer-arkade/adapter-session.ts`
- `BIS/packages/integration/src/client/wallet-layer-arkade/addresses.ts`
- `BIS/packages/integration/src/client/wallet-layer-arkade/app-wallet-session.ts`
- `BIS/packages/integration/src/client/wallet-layer-arkade/address-projection.ts`
- `BIS/packages/marketplace/src/client/marketplace-layer/App.tsx`
- `BIS/packages/marketplace/src/client/marketplace-layer/wallet-label.ts`

Tests and fixtures:

- `BIS/packages/integration/tests/client/addresses.test.mjs`
- `BIS/packages/integration/tests/client/address-projection.test.mjs`
- `BIS/packages/marketplace/tests/client/catalog.test.mjs`
- `BIS/packages/marketplace/tests/client/wallet-label.test.mjs`
- `BIS/packages/marketplace/tests/client/wallet-label-browser.test.mjs`
- `BIS/packages/marketplace/tests/client/wallet-label-fixture.mjs`

Planning scope is this change's complete archive and the added requirements in `openspec/specs/app-wallet-session/spec.md` and `openspec/specs/marketplace-catalog/spec.md`. The unrelated TypeScript-conversion proposal and runner commits are excluded. Root owns the final integrated gate, canonical export/import, and coordinated normal push; this task supplies the scoped commit and verifies its inclusion remotely.
