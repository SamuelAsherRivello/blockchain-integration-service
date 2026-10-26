# Treasure qualification handoff, 2026-10-26

The subsequent [T010 hardening review](treasure-t010-hardening-2026-10-26.md)
adds a tested game-only production CSP candidate, explicit per-offer funding
consent and pinned-SDK exit disclosures. T010 stays open for deployed/imported-artifact
verification. The game dependency and all live financial gates remain separate.

This supplements [the program](program.md) and C094's existing requirements. It
does not change qualification criteria, complete blocked tasks or authorize a
release. The coordinator owns live execution and the final integrated gates.
The Treasure owner prepared this reconciliation without provider requests,
financial actions, runtime changes or edits to the bounded-funding files under
independent review.

## Current result

Treasure is not production-qualified. The initial reconciliation found
18 completed and 18 remaining game tasks. This historical aggregate includes deferred game work
and is not a BIS readiness percentage. T012 and T013 are now checked complete;
earlier reports describing their three game regressions as outstanding are
historical. The later assigned T034 fixture completion is recorded in
[its handoff](treasure-t034-fixtures-2026-10-26.md). T006/T007 and T035 remain open.

The approved browser-policy mode can qualify for its own disclosed guarantees
without covenant proof. C094 design explicitly separates the two qualifications.
Browser-policy qualification still requires its actual lifecycle and safety
matrix to pass. It does not complete the stronger covenant requirements or waive
the existing production rollout gate. The current evidence does not establish
that either browser configuration has completed its full matrix.

## Network and mode boundary

| Configuration | Approved behavior | Existing evidence | Outstanding qualification |
| --- | --- | --- | --- |
| Signet, browser-policy-v1 | Admin's sole signing option. Real contract-derived output, funding, SDK spends and receipts; browser controls eligibility. | Historical exact Claim, Reject, expiry/refund and portable recovery passed. Subsequent identity/race, actual network replacement and genuine 0.0.23 creation-disabled refund passed. | Remaining browser matrix below. No claim of network-enforced deadline or destination covenant. |
| Mutinynet, browser-policy-v1 | Explicit Admin test option; API may select it only through supported pre-funding capability selection. Same disclosed browser trust. | Historical Claim, Reject, expiry/refund and portable recovery passed. | Remaining browser matrix below, independently of Signet. No covenant claim. |
| Mutinynet, historical co-signer artifact | Real stronger-mode lifecycle, with its original script, identities and terms. | Historical Claim, Reject, expiry/refund and portable recovery receipts passed. | These receipts do not establish late-claim rejection or pre-deadline admission followed by post-deadline finalization. They do not qualify a different V4 artifact. |
| Mutinynet, current V4 candidate | Exact compiled script and funded ancestry, actor-authorized transaction, staged operator admission and original checkpoint completion. | Isolated script, authorization, journal, recovery and runner tests pass. Qualification runner has 50 offline passes. | B1 remains blocked before funding. B2 has not run funded. Current artifact's full applicable lifecycle matrix and integration gates remain required. |

Mutinynet Admin defaults to the co-signer option. An explicit selection must
report unavailability rather than silently downgrade. The game API offers no
player choice and selects the best supported mode before funding. An existing
contract retains its persisted mode, amount, rounded-down original deadline,
identities and network. An unknown submission never authorizes browser fallback,
new funding or a competing spend.

Browser policy is a real implementation with weaker enforcement. It cannot
prevent a party with the relevant signing access from bypassing browser time
checks. UI denial and local VM tests do not prove remote covenant enforcement.
No simulated transaction, fabricated identifier or ordinary transfer substituted
for a contract is acceptable in either mode.

## Remaining browser acceptance cases

The [bounded matrix](../../../BIS/documentation/treasure-bounded-acceptance.md)
contains the historical per-mode receipts. The
[hardening report](../../../BIS/documentation/treasure-hardening-acceptance.md)
adds the later Signet passes and preserves failed attempts. Reuse these exact
results only for the artifact, network and preconditions they actually cover.

| Case | Signet browser | Mutinynet browser | Stop condition |
| --- | --- | --- | --- |
| Player starts empty | Historical S1 passed | Original zero-balance precondition not established | Verify the real precondition before any assigned case. |
| Intentional lost acknowledgement and original recovery | Historical pass | Intentional loss not established | Recover only the original operation; preserve unknown reservations. |
| Session-end cancellation, distinct from closing the browser | Deterministic only | Deterministic only | One bounded assigned live case; no replacement after unknown. |
| Duplicate or competing actions | Local safeguards and Signet identity/race pass; complete adversarial live coverage not established | Deterministic only | Establish each actual race precondition; never infer all races from one pass. |
| Identity/network replacement and immutable terms | Later real network/identity cases passed for their stated scope | Corresponding live replacement unperformed | Reuse Signet receipts; prove Mutinynet separately. |
| Asset carrier and exact asset-preserving change | Live unperformed | Live unperformed; mint harden-asset-mint-m1 unknown | Preserve the mint reservation. Reopen only with new original-operation evidence. |
| Insufficient funds and fee-policy change | Deterministic only | Deterministic only | Fresh normal readiness and exact-cost evidence; do not manufacture a success. |
| Creation-disabled legacy recovery | Genuine 0.0.23 Signet refund passed | Corresponding live case unperformed | Retain original terms and wire; reuse only the matching legacy pass. |
| Funded local feedback/navigation p95 | No live timing sample; prior case stopped unfunded at unavailable readiness | No live timing sample | Reopen only after new readiness evidence. One sample does not establish p95. |

Corruption, stale import and reset/logout safeguards have deterministic coverage;
they do not provide extra network lifecycle passes. Final artifact acceptance
must state which prior receipts remain applicable after source changes. The
current V4 candidate cannot inherit those receipts merely because the amount and
visible feature match.

## Stronger-mode blockers and bounded next action

B1 is attributable rejection of a validly signed claim whose committed deadline
has passed. The fresh connected GitHub review still finds
[emulator issue 119](https://github.com/arkade-os/emulator/issues/119) open and
the [current handler](https://github.com/arkade-os/emulator/blob/master/internal/interface/grpc/handlers/emulator_handler.go)
returning a generic error for service failures. The reviewed handler Git blob is
`abae7d1ba8ca93aa633f2935b5c131dc3bb3a3b1`. This is source evidence, not
attestation of a live deployment. The existing unconditional pre-funding refusal
must stay. Do not repeat the inconclusive probe.

Reopening B1 requires a trusted operator diagnostic tied to the original request,
funded outpoint and compiled script, with server execution time and sufficient
predicate context to distinguish deadline rejection from signature, ancestry,
parser, expiry, amount or destination failure. An existing operator trace can
suffice if it contains that evidence. Otherwise a reviewed diagnostic fix must
be deployed at the supported trusted endpoint. A different generic status code
or an SDK upgrade cannot supply information the server omits. No maintainer
contact was sent in this pass.

B2 independently tests actual operator SubmitTx admission before the original
deadline, then ordinary Player checkpoint signing and exact original payout
after the deadline. Emulator-only approval is insufficient. The runner is
offline-verified but has no funded B2 result. The initial coordinator pair scan
found no eligible clean source coin. The subsequent coordinator handoff reports
one authorized 1,000-sat faucet operation settled with a funding-verified receipt,
followed by a GET-only scan finding exactly one eligible 1,000-sat source coin in
`treasure-empty-game-mutinynet`, 1,000 of 10,000 sats rolling exposure and no
pending conflict. These financial results are coordinator-reported here; this
Treasure reconciliation did not access the wallet or independently fetch the
receipt. Eligibility and budgets still require fresh checks at execution.

The funded prerequisite has therefore progressed beyond the initial blocked
scan. The next executable step is one coordinator-owned B2 run, subject to fresh
protected grant, rolling-budget, pending-operation, exact-cost and source-
eligibility checks. Do not fund again. Root's source verification records
28/28 offline funding regressions, all four source hashes matching and repository
typecheck passing. This does not prove a faucet transaction. Keep the financial
slot serialized and retain the real original funding receipt. Shared faucet
preparation is not a newly atomic no-onboarding
guarantee; its existing available-funds path still requires coordinated use.

For an assigned funded case, preserve the existing 5,000-sat per-operation and
10,000-sat rolling budget rules, exact 1,000-sat contract amount and approved
source identity. Observe at most 120 seconds, then one read-only reconciliation
of the original operation. Unknown means preserve reservations and stop. It does
not mean failed. A B2 pass would not close B1 or qualify rollout by itself.

After that coordinator update, this owner independently recomputed the runner's
11-input runtime pin. It still equals the offline-approved SHA-256
`f702ab5e51b7e2836d95dbb9f01a0d402ec087974a707ad77d34d6c72f813bae`.
All 15 files from the offline source snapshot are unchanged. These paths remain
frozen; no source edit or further test rerun is needed merely to account for the
new eligible coin. A live run must use its own exact run ID for both existing
execution/financial leases and this approved source hash, then preserve its
original protected journal on every failure. This is source readiness for the
single B2 check, not a guarantee that the network will accept the contract.

## Game and final integration boundary

Source inspection confirms the coordinator's host fixes: restored cache becomes
unverified, matching includes network/operator and exact terms, and unresolved
claims survive presentation expiry and stale funded projections. The prior TODOs
are executable assertions now. The coordinator reports 18 related tests and
contract typecheck passing; this reconciliation did not rerun those tests.

The game inventory still names `bis-integration-0.0.23.tgz`, SHA-256
`1ad3cdb15b4d67d23a42addedb921999aff30bde694f0bc6a5bb546995aceace`.
Host fixes do not import the new BIS candidate. Preserve the separate verified
export/import workflow and defer package import until the BIS gate is met.

Finish the coordinated source freeze, run the full BIS tests/typecheck/build,
CSP and dependency gates against that unchanged snapshot, and record every
remaining live case as passed, failed, blocked or unperformed. The historical
T036 pass and focused current checks do not establish a new final integrated
pass. Protected Preview/runtime signing, release, artifact import and game
acceptance remain program gates. Existing production endpoint availability with
signing disabled is not current-candidate signing proof.

## Evidence locations

- `output/reports/treasure-contract/staged-prototype/b1-attribution-followup/`
  contains the fresh primary-source review and exact B1 reopening criteria.
- `output/reports/treasure-contract/staged-prototype/v4-qualification/`
  contains the runner source pin and 50 offline checks. Its strict full imported
  script graph retained 212 baseline diagnostics with zero introduced; that
  stronger check did not pass. This differs from root's later repository
  typecheck, which passed for bounded-funding verification.
- `output/reports/treasure-contract/staged-prototype/bounded-faucet/root-verification-2026-10-26/verification.json`
  records the independent 28-test result and source hashes.

These ignored output records are local evidence, not published release assets.
The tracked acceptance documents retain the historical public receipt index.

## Follow-up on recovered transaction class guards

The coordinator's separate authorization review identified an SDK class mismatch.
A wallet-free probe independently reproduces it: an SDK-created PSBT parsed with
SDK `Transaction.fromPSBT()` is not an instance of SDK `Transaction`, but is an
instance of the underlying `@scure/btc-signer` transaction class. Its bytes round
trip unchanged. An SDK constructor check can therefore reject valid recovered
transaction objects.

This does not intersect B2. An in-memory esbuild dependency check finds 22 local
runtime inputs for the qualification runner, including dynamic local imports.
Neither `treasure-journal-signer.ts` nor `server-wallet-protocol.ts` is reachable;
neither is part of its 11-input runtime pin. The pin still matches the approved
value above. B2 uses direct PSBT parsing and local Player signing, not the hosted
journal bridge. No B2 source change or re-pin is needed for this finding alone.

Current source inspection also finds the journal signer already imports
`BitcoinTransaction` from `@scure/btc-signer` and uses that guard in sign,
completed-result recovery and original-argument recovery. Its observed SHA-256
is `7afc9896fedef70e2a2c695b1f2613fc14ab569b9c81a40c45071dcd15775e73`.
This owner made no change to that file. Preserve the separate correction and
independently verify real SDK serialization and saved-result recovery before the
hosted integration gate; the isolated B2 runner cannot qualify that bridge.

The scope report is
`output/reports/treasure-contract/staged-prototype/v4-qualification/b2-journal-guard-scope-2026-10-26.json`.
No wallet, provider or signing operation occurred. The existing single-run B2
conditions stand, and B1 remains blocked.

The subsequently assigned wallet-free journal verification is now complete.
One deterministic regression was added to `treasure-journal-signer.test.ts`.
It recreates the bridge after lost ROOT and checkpoint responses and exercises
both original-argument recovery and completed-result decoding through the actual
installed SDK. It asserts the base-class identity, exact PSBT round trip, valid
signatures and one original-result lookup without another signing request.
The focused journal-signer and transport suites pass 12/12 with no skipped or
TODO tests. Targeted strict checking with Bundler/Vite settings passes, and the
requested configured root command `npm run typecheck` also exits 0 with no
diagnostics. Earlier incorrectly configured targeted compiler invocations are
retained in the evidence; they did not establish a production source failure.

Only that deterministic test file changed in this verification. Its SHA-256 is
`70a95a927889d2ac9a9daf21c8a380c828eadc2e7be790ac80f9283d713bf053`.
The journal signer remains at the observed hash above. All 12 local verification
inputs have modification times before the test log was created, and the B2 pin
still matches after repository typechecking. The complete hash scope, commands
and logs are recorded in
`output/reports/treasure-contract/staged-prototype/journal-guard-verification/verification.json`.
These fixtures use public test scalars and a closed transport. They provide no
hosted or live-network qualification and access no credentials, provider or
wallet. No B2 input, game dependency or live operation changed.

The later C094-T034 assignment completes only protected acceptance-fixture
readiness. The new diagnostics projection, SDK empty-player construction test,
81 focused passes, type gates and exact source scope are in
[the T034 handoff](treasure-t034-fixtures-2026-10-26.md). The canonical checkbox
is updated; the CLI now reports 23/36 complete with T035 unchecked. No live or
qualification gate changed. The coordinator's latest B2 attempt stopped at
protected-vault authorization before provider access, so its source-ready
status above must not be read as current live execution readiness.
