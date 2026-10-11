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
