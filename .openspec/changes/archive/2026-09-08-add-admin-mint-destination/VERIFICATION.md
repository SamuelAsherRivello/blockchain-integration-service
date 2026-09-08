# Admin mint destination verification — 2026-09-08

## Implemented

- Destination offers Player wallet and Game wallet, defaulting to Game wallet. The chosen wallet funds and receives its own issuance through its existing API.
- C1 availability includes an active player, game mint readiness or game pending recovery. Destination preparation checks pending state before new-mint funding; failed reads do not become empty recovery state.
- An unresolved destination offers Resume pending mint before entering the immutable request, so reopening can reach pending work in either wallet. Submissions retain destination, originating profile and operation ID; duplicate clicks, stale lookups and late replacement-wallet results are guarded.
- Admin Console records destination and originating public profile for operations. No signing material is exposed.
- B1 appends `(Player->Game)`. F3 reads `F3. Send 100 Sats (Game->Player)` and requests 100 sats for new payments. Historical payment metadata and original amounts remain recoverable.

## Automated evidence

- 24 tests passed across demo mint-destination/admin-assets and integration game-player-payment/game-wallet test files. Includes selected-wallet-only routing, missing wallet/failed lookup/insufficient funds, pending recovery without new funding, replacement during lookup/submission, duplicate submissions, unknown outcomes, 99/100-sat availability boundary, and historical 1000-sat payment protection.
- 26 core asset-context/assets tests passed in isolated Node test processes. An initial combined `--test-isolation=none` run had one global-state interference failure; rerunning with normal process isolation passed all 26.
- `npm run build` passed, including TypeScript and both package builds. Vite reports existing dynamic-import and large-chunk warnings. Sandbox process restrictions required the normal supported escalation for builds and isolated test processes.
- `openspec validate add-admin-mint-destination --strict` passed.

## Real-browser UI evidence

`BIS/scripts/smoke-mint-destination.mjs` passed in installed Microsoft Edge through Playwright against the localhost Vite server. The host at `/tests/mint-destination.html` uses explicit isolated wallet callbacks and never creates a signing wallet or live mint.

Covered default game selection, keyboard selection, preset metadata retention, 390 × 650 responsive scrolling, focus restoration, submission to each destination, player-only/game-only/neither availability, failed lookup, insufficient game funds, delayed game lookup after player selection, both wallets' recovered requests, wallet replacement during held submission, and identical unresolved retry IDs. The production App page was also checked for the B1/F3 rendered labels. No browser page errors occurred.

Screenshot: `output/playwright/mint-destination-mobile.png`.

## Live Signet acceptance: blocked by missing prerequisites

No funded real player/game wallets were provisioned in the isolated browser context. No live mints or F3 payments were performed. There are therefore no new live asset IDs, receipt IDs, or fresh holdings to report. Historical evidence is not reused as proof of this change. Live acceptance still requires an explicit real mint to each destination and fresh ownership verification; the 100-sat F3 route also has not been exercised on Signet in this run.

## Documentation and concurrent work

C1 documentation describes both destinations and recovery. B1/F3 labels and F3 amount are updated in the demo README and user-story document. The overlapping reorganize-game-wallet-actions story delta now carries the same F3 label and 100-sat threshold. Existing unrelated work was preserved; no commit, archive or deployment was performed.

## Follow-up: Mint input selection unavailable

The screenshot exposed a blanket reservation guard in both availability and issuance. Fixed by excluding reserved outpoints from the balance calculation and from the temporary signing wallet's public getSpendableVtxos method used by the actual SDK AssetManager.issue. The pre-submit boundary rechecks reservations. Core mint dispatch now permits known reserved inputs while preserving the fail-closed behavior for missing storage and unverifiable reservations. No journals were deleted or cleared.

Test-first evidence: the two adapter tests selected by `node --test --test-isolation=none --test-name-pattern="unreserved inputs|reserved balance alone" BIS/packages/integration/tests/asset-adapter.test.mjs` failed before the fix and passed afterward. The two context tests selected with `--test-name-pattern="known inputs permits"` likewise failed before and passed afterward. Full asset-adapter, asset-context, wallet-reservations and mint-destination suites passed: 48 tests. Production build passed. Controlled SDK boundary tests verify actual coin selection, all-reserved funds, unverifiable reservations, and a newly reserved input immediately before network submission. No live wallet issuance was performed.

## Production/Admin parity revision

The Admin-only availability veto has been removed from destination preparation and C1 entry. C1 now depends on wallet presence/activity; pending-state lookup, identity checks and duplicate protection remain. Player Admin submission uses the same context.mintAsset method invoked by createBisAssetCollection. Game submission still uses its controller and the existing common issuance adapter. Production core, SDK adapter, game reward policy and the separate game's package were not changed during this revision.

Test-first: `node --test --test-isolation=none BIS/packages/integration-demo/tests/mint-destination.test.mjs` failed in the two new parity/error cases before the edit, then passed all seven tests afterward. The regression invokes actual createBisAssetCollection and Admin preparation against the same controlled mint method, proves both succeed despite a false or throwing old balance check, and proves that check is never called. Insufficient funds is forwarded from the mint method instead of masked as busy.

Focused mint-destination, admin-assets, asset-collection, asset-context and asset-adapter suites passed with isolated Node processes. TypeScript and production build passed. The Edge smoke script passed both destinations, authoritative insufficient-funds feedback, absent wallets, failed pending reads, duplicate/recovery and replacement scenarios. These are isolated browser/adapter tests, not live transaction evidence. The user reports successful real player minting in the game's packaged version; this is the user-observed baseline, not independently observed Admin live parity. No live issuance was made by this revision.

## User acceptance before archive

The user confirmed that reopening Admin Mint Asset and selecting Player wallet worked after the production-parity fix, approved the result, and requested sync and archive. The user also confirmed the existing game's trophy mint/burn/recollect flow works with an unchanged Arkade balance. These are user-observed live outcomes; no transaction identifiers were collected by the agent.
