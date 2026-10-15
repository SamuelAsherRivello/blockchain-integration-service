# Reconciled continuation verification — 2026-10-11

## Scope and inherited evidence

The coordinator assigned this continuation after the public Game inventory
boundary remained unimplemented. The earlier reconciliation-audit.md describes
the checkout before this continuation; its direct-SDK and unreconciled-plan
findings are resolved below, not current defects.

The archived 2026-10-10-update-caching and 2026-10-10-background-caching
changes supersede the original 15-second freshness, immediate cached modal
reveal, and blanket cancellation on view exit. Their checked implementation,
browser acceptance and verification records cover the shared policy, Account
Details, collection views, refresh accessibility, background sharing and
mutation boundaries. This continuation preserves those decisions and reconciles
the proposal, design and deltas against the current canonical requirements.

## New implementation and focused verification

BIS now owns public-address inventory preparation, complete-success-only
memory caching, in-flight joining and scoped invalidation. Public queries add
the exact address to the role/profile/network/data-kind key; they never alias
full account ownership. Player Marketplace inventory continues to use the
same account preparation snapshot as Account Assets. Guest Game browsing and
the connected Game Wallet address selection are preserved.

The adapter uses SDK hasTerminalSpend, including spentBy and settledBy,
and includes recoverable/unrolled holdings for ownership reporting. The
single-address query remains narrower than the wallet's registered scripts;
neither query establishes spendable transaction inputs. Terminal-marker and
recoverable/unrolled tests pass. No discrepancy is attributed to these
markers without live evidence.

Wallet evidence now supersedes active Marketplace presentation work even if
that work was forced. A regression exercises the actual BIS public cache,
invalidates an active read, starts replacement work and proves an old
abort-ignoring result cannot overwrite the replacement.

Fresh focused run: **109 tests passed, zero failed**, covering view policy,
view cache, read coordinator, background cache/context, Account Assets,
shared/public inventory and all Marketplace tests. Exact ignored log:
output/reports/codify-view-loading-and-cache/focused-tests.log.

## Edge browser acceptance

Retained runner: BIS/scripts/check-marketplace-cache.mjs, using the existing
shared preview on port 5174. Three fresh isolated Edge contexts passed:

- Game finishes first: default Game shows its item; selecting pending Player
  stays covered until Player finishes and reveals its two fixture items.
- Player finishes first: selected Game stays covered until its own result;
  Player's completed result is available on selection.
- Account Assets preparation before Marketplace is reused without another
  Player read. Account navigation is closed before interacting with tabs.

Each case exercises the actual Marketplace, BIS context and cache with
synthetic read dependencies, shows Shoes I and Dagger I in Player, switches
owner tabs six times, observes exactly one Player and one Game provider read,
and records zero page errors. Game-first and Account-cache screenshots were
visually inspected. These are synthetic acceptance cases, not live holdings.
Ignored evidence: output/reports/codify-view-loading-and-cache/synthetic-browser.json,
the adjacent log, and game-first.png/player-first.png/account-cache.png.

## Live evidence and remaining work

An exclusively assigned read-only OwnedBrowser session restored the expected
Mutinynet identities using the approved vault boundary. Normal Account Assets
displayed two rows, and the actual shared Player cache contained the same two
quantity-one holdings. Both classify as **generic**, with no BIS equipment
metadata. The current-address public query returned zero; it covers a
different ownership scope and is not evidence that the wallet owns zero.
Only allowlisted public results were retained in
output/reports/codify-view-loading-and-cache/owned-two-item-player.json.
The browser closed and the exclusive vault slot was released.

Task 5.5 remains unchecked: the required live two classified Marketplace item
cards were not established. No classification was changed to manufacture
equipment, and no mint, burn, transfer or other financial mutation was run.
Tasks 4.1 and 4.3 are now verified at the committed checkpoint below.
This change is **open**, its deltas are not synced, and it is not archived.

The durable User Story Diagrams loading guidance now distinguishes nonmodal
Account Details, construction-gated modal views, five-minute shared reads,
public address scope and the remaining live acceptance gap.

## Final integrated verification checkpoint

The coordinator reported the coherent `npm run test:all` process completed
with exit zero, and the exact retained log was inspected:
output/logs/final-22-release/test-all-final.txt. Main tests passed **1045/1045**
with zero skips; onboarding passed **91/91** with zero skips; faucet passed
**16 tests**, with one optional live test skipped and zero failures. The skip
is not claimed as live acceptance.

The successful main run includes the actual browser tests `deferred warm
reads are adopted by Details, Receive, Send and Swap with normal loading`
and `account page policy blocks active, host, and retained spinners at both
overlay boundaries`. These complement the collection/view policy tests,
cache expiry/invalidation and late-result tests, archived update/background
browser acceptance and the three fresh Marketplace Edge fixture cases above.
Expiry and invalidation assertions include state-layer tests; the synthetic
Marketplace screenshots alone do not prove every Account destination.

Explicit `npm run typecheck` also completed with exit zero; retained log:
output/logs/final-22-release/typecheck-final.txt. The verified implementation
checkpoint is commit `d138e3a746aa97ec70c8f36852bf30768b7cfcb5`.
Earlier sandbox/browser-environment failures and the superseded onboarding
test-clock failure are separate attempts, not the result of this coherent
run. Their logs remain under output/logs/final-22-release/; the coordinator
corrected the test clock before the successful final run.

This closes tasks 4.1/4.3 and leaves **15/16** tasks checked. It does not close
the live requirement in 5.5. A separately assigned Marketplace address-label
optimization follows this checkpoint and remains subject to the coordinator's
subsequent release gates; this note does not pre-verify that later work.

## Bounded existing-fixture discovery

At 22:18 on 2026-10-11 (Asia/Tbilisi), the coordinator-assigned exclusive
read-only discovery checked supplied test-account-1 through test-account-4
and existing agent-player-1 on both Mutinynet and Signet. All ten bounded
full-wallet asset reads completed successfully through the same approved
`listWalletAssets` adapter used by the runner's observations boundary.
Test-account-2 on Mutinynet held two generic assets and zero classified BIS
items. The other nine account/network combinations held zero assets and
zero classified items. No qualifying existing two-item fixture was found
in this deliberately bounded set; this is not an exhaustive claim about
other registered identities or wallets.

Only public labels, networks, profile IDs, counts and classification results
were retained at
output/reports/codify-view-loading-and-cache/existing-fixture-discovery.json.
The helper suppressed SDK/provider logging and kept recovery material private
in process memory. No pair assignments, accounts, holdings, funding requests
or operation journals were changed. No browser session was opened. Discovery
finished and the exclusive slot was released. Task 5.5 remains unchecked;
no financial workaround or fabricated metadata was attempted.

## Final live two-item acceptance — 2026-10-12

This checkpoint supersedes the earlier fixture gaps above. At the user's
explicit request, the wallet owner delivered one additional valid Dagger I
to test-account-2 on Mutinynet. The reconciled delivery transaction is
`602bb0dd4a3bc696ce3d86b0166c31140644424bc14676f64cf238f0e59ca542`;
public receipts are retained in output/reports/game-item-transfer/second-delivery.json
and second-after.json. The cache owner performed only read-only verification.
Shoes I and Dagger I are quantity one each; both existing generic holdings
remain intact. No metadata was fabricated or generic asset reclassified.

The initial live run exposed a real lifecycle race: wallet evidence invalidated
a pending Player inventory read, and Marketplace retained its unavailable
result even after Account Assets read successfully. Browser-only diagnostics
confirmed the request entered with an active account, so hydration alone was
not the live failure's cause. The scoped context fix tracks asset-evidence
revisions and lets compatible waiting consumers adopt replacement work/cache
within their original 30-second inventory budget. It also joins account
hydration before preparation. Disposal/account changes remain terminal;
ordinary provider failures do not automatically retry. No Marketplace App
or TypeScript-migration source was changed for this correction.

Five new regressions in
BIS/packages/integration/tests/client/asset-inventory-readiness.test.ts cover
hydration adoption (including synchronous subscribers), account replacement,
disposal, two consumers sharing one replacement after evidence invalidation,
and no automatic provider-failure retry. Hydration tests failed on the base;
the evidence-invalidation test failed with the hydration-only correction;
all five pass with the final correction. The focused canonical context,
cache, profile and Marketplace suites pass **43/43**, with no skips or failures.
Logs: output/reports/codify-view-loading-and-cache/overlay-focused-tests.log
and readiness-regressions-final.log.

Verification used the coordinator-owned isolated preview on port 5176,
based on commit `efcfb022b8efa5cfa4d51d298ad003c67ce06134`, with only context.ts
and the new regression overlaid in output/packages/final-22-source.
Exact overlay SHA-256 values are recorded in live-two-item-cache.json.
The coherent snapshot's `npm run typecheck` passes (overlay-typecheck.log).
The released 0.0.22 tarball/provenance was not modified or repacked.
The broader full-suite checkpoint above remains historical baseline evidence;
the ongoing unrelated TypeScript migration was not claimed as verified.

The final **uninstrumented live Edge run passed at 07:00:35 UTC**:
Account Assets displayed four rows (two ready equipment items and two generic
holdings); Marketplace arrived on Game Wallet with seven cards. Player Wallet
displayed exactly Shoes I and Dagger I. Six subsequent tab switches retained
seven Game/two Player cards, reused the exact Player cached assets array,
made **zero additional inventory queries**, and produced zero page errors.
Evidence: output/reports/codify-view-loading-and-cache/live-two-item-cache.json,
live-account-assets.png and live-marketplace-player-two-items.png.
The browser closed normally and released its exclusive profile slot.
A transient vault-lock failure preceded this run; the wallet owner finished
at 06:59:35 UTC, and no lock was deleted or overlapping session used.

The retained synthetic Edge runner also passed all three modes after the
final overlay: game-first, player-first and account-cache. Each displayed
two Player cards with exactly one Player/one Game provider read and no page
errors (synthetic-browser-overlay-final.log). These simulated completion
orders complement, and do not substitute for, the real delivered-item run.
Task 5.5 is verified; all **16/16** tasks are complete.

The final inline spec reconciliation updated only marketplace-inventory-cache;
the other seven delta capabilities were already synchronized. Recomparison
finds no remaining delta operations. Strict change validation passes with no
issues, and strict main-spec validation passes **63/63**. Existing main-spec
Purpose/title and unmentioned requirements/scenarios were preserved.
