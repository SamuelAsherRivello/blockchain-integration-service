# Verification

Verified on 2026-10-21. No release, commit, or archive was performed.

## Real network events

Both networks delivered a real payment and asset arrival to their configured Wallet 1 public addresses. The monitor used independent indexer subscriptions. The sender used the existing Send Payment, Mint Asset, and Send Asset demos in isolated browser profiles. The monitor never received a mnemonic.

| Network | Payment transaction, 100 sats | Asset-send transaction, one unit plus 330 sats |
| --- | --- | --- |
| Signet | `68d26d064f8d69185cd1a94c260460fb386d78301f5024d82e18c4f364e06355` | `0eb4de849c6a4e83ca899cfa343f8a3b826257a7c3eb50a5e05aff7fc474f4b8` |
| Mutinynet | `b1cbdea8bdeb89c0b3a362fd5c42d58130921c96e4b2109573e816396d1c200c` | `951c1e9609b7af2fc8d10e098eb169e7476cc3c0469defad84e8c5f6cad1aa9c` |

The Signet asset ID is `f7fe03f97b78d2dcbf17af19da370b1e68267e0fa6ed1e469657cf850e526a330000`. The Mutinynet asset ID is `8fd95d3745a49d41ef8658d6018ada55ee12a01ebe19b6210ce189525d3cf5270000`. Fresh SDK indexer reads independently verified each destination output at index zero, its sats, and its asset quantity.

Public screenshots and run reports are in `output/reports/prototype-wallet-events/`. Both payment and asset messages showed three one-second animation cycles and reset to listening after six seconds. Separate `signet-connection.json` and `mutinynet-connection.json` record successful live offline/reconnect checks, with no replayed receipt messages. Earlier `*-live.json` reports include the transfers and the old failed connectivity check; the successful connection-only reports supersede that connectivity result without repeating funded operations.

Signet used the approved test-account-1 sender. Mutinynet used a dedicated protected account, events-mutinynet, funded with 50,000 test sats from the local faucet. Existing pending funding operations were not cleared or replayed. The faucet operation `events-dedicated-mutinynet-20261021` settled with transaction `dc2e64b2ebfb6a040a65f9636abd8fbf2ce07806be9419ab7bdfef4e571ccd65`.

## Automated checks and limits

Root typecheck and the sandbox production build passed. Focused observer, navigation, route, source, and presentation checks passed. Browser checks cover popup sizing, independent navigation, reuse, closure/reopening, blocked popups, configuration replacement, exact asset quantities, animation timing, reduced motion, and reconnection. Test transports are confined to tests.

All 52 sandbox checks passed in their applicable environments: 50 against the production preview, and both conditional-vault journal-exclusion checks against development. Those two checks explicitly import source modules that are unavailable in static build output. Root typecheck and strict OpenSpec validation also passed.

The shared development server on 5174 was ownership-verified and preserved. Its existing stale optimized Mermaid dependency returned HTTP 504, including on unchanged demo-1. Production browser checks therefore used an isolated build preview on 6018. The overview smoke test also needed to explicitly select Intro because overview-tab selection persists across demos. The fixed test passed against the production build, including Events.

An additional direct strict compile of the prototype modules encountered existing untyped faucet helper errors outside the root typecheck's include set. It reported no diagnostics in the new monitor modules. This does not replace the passing configured root check or claim those older helpers have been migrated.

Live receipts and reconnection were exercised on both networks. Spent/swept output descriptions and duplicate transition handling were verified deterministically; no wallet-spend or sweep event was manufactured for live acceptance. External-wallet sending remains an optional manual path and was not exercised.

## Finalization verification, 2026-10-21

The user subsequently confirmed Send Payment and Send Asset delivery and accepted the expanded UI. Those later decisions use five-second newest-event notifications, one-second animated status dots, a 7px-rounded card with a Y-axis flip to a full-height in-memory chronological log, network labels, fixed-width navigation, identity/network-scoped SDK storage, and local development source windows with GitHub links in production.

Fresh verification against the shared development server passed all 59 sandbox tests, including rendered SVGs for every one of the 21 demo Diagram tabs. Root `npm run typecheck`, `npm run build --workspace @spike/prototype-sandbox`, and strict validation of this change also passed. Browser tests cover the updated five-second reset, normal and reduced-motion flipping, keyboard interaction, log ordering, events while flipped, network labels, local-source allowlisting, and storage separation. Read-only SDK wallet creation after Setup submissions succeeded for alternating identities and networks in two isolated browser profiles without reloading. No user browser wallet data was reset.

The diagram regression was reproduced as HTTP 504 `Outdated Optimize Dep` on Mermaid's dynamically loaded sequence renderer. The shared development configuration now separates caches by preview port and excludes Mermaid from dependency prebundling. The sandbox uses Mermaid's self-contained ESM distribution to avoid nested CommonJS imports. The owned frontend and its owned faucet child were restarted under the startup lock; all configured routes were healthy afterwards. Existing caches and wallet data were preserved. This supersedes the earlier shared-preview diagram limitation above.

### Verification scorecard

| Dimension | Result |
| --- | --- |
| Completeness | CLI reports 12/12 reconciled tasks complete; all 13 requirements have implementation and verification evidence. |
| Correctness | Public-address filtering, exact quantities, quiet baseline, replay handling, connection lifecycle, and both-network live receipts are evidenced. Updated presentation and shared-demo behavior pass focused browser checks. |
| Coherence | The user approved reconciliation on 2026-10-21. Proposal, design, delta spec, and completed-task descriptions now match the accepted five-second notification, session log, animated status, and shared-demo refinements. |

No critical issue, warning, or skipped applicable verification check remains for this change. Planning reconciliation is complete, strict change validation passes, and the main spec is synced. The change is archived as `2026-10-21-add-prototype-wallet-events` with 12/12 tasks and no archived-validation issues. This report is recorded before commit/push. Existing unrelated work in other packages and scripts remains outside the scoped commit. Only the diagram-cache hunks in the shared development configuration belong to this change.

All 66 main specifications passed strict validation. The repository-wide archived-task audit passed 103 of 115 archives; 12 older archives retain pre-existing incomplete tasks. This archive passed. No older archive or unrelated task was edited to make that aggregate audit pass.

### Requirement evidence

- Events entry and teaching flow: navigation/source/route tests and Events overview/browser checks.
- Independent popup: browser sizing, resizing request, captured network label, corner styling, sidebar navigation, and opener-closure checks.
- Public-address observation: exact-script ledger tests, precise asset quantities, deterministic received/spent/swept transitions, and public receipts on both networks.
- Quiet startup and deduplication: baseline, buffered-arrival, replay, and reconnect observer tests.
- Message/pulse timing: controlled five-second timer tests and three-cycle browser animation inspection, including replacement and reduced motion.
- Connection/resource lifecycle: bounded setup timeout, cancellation/disposal, popup reuse/replacement, and both-network live reconnect reports.
- Separate UI/live acceptance: deterministic transport fixtures remain test-only; public funded receipts and independently queried outputs are recorded above.
- Animated idle status: browser-clock one-second cadence and three-step repeat, with source-owned visibility/flipped pause cleanup and stable accessible labels.
- Flip-side history: browser checks for rotation, chronological connection/activity lines, incoming events while flipped, keyboard toggles, full-height scrolling, and reduced motion.
- Network-aware actions/navigation: all 21 demos on both networks, computed primary/secondary typography, immediate network change, and fixed-rail geometry at seven viewport widths.
- Submitted Setup/isolated state: persistent-repository browser tests and real read-only SDK creation after alternating submitted identities in two isolated profiles.
- Readable source: all demo destinations, opening each of the four allowlisted source files without executing them, unknown-path rejection, and GitHub production-mode URL checks.
- Shared diagrams: all 21 live development SVGs rendered; port-specific cache configuration regression and package production build passed.
