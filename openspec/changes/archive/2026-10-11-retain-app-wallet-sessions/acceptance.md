# Retained app wallet sessions — acceptance

## Implemented boundary

An app-local private owner lazily retains one Player SDK wallet and one optional
Game SDK wallet. Candidates are serialized through those same slots. There is
no phrase-keyed global signer cache or new public SDK/session API. SDK automatic
settlement is disabled. Successful activation reuses its validated candidate;
navigation and forced live reads do not reconstruct it.

Authoritative reads query every registered contract, including inactive and
recoverable contracts, from time zero with complete validated pagination. They
project only the response, not the SDK repository's upsert-only union. Independent
attempt-local read views isolate provider/method interception and complete
ownership snapshots. These are lightweight views of the retained resource, not
new SDK wallets or repositories. History and settlement never hold the fresh-read
lane. Operator validation, ownership and Bitcoin balance requests overlap, but
all required evidence must succeed before the result is returned.

Signing remains exclusive per role; simultaneous two-role leases have a fixed
Player-then-Game order. Existing mutation locks, reservations, live fee/policy
checks, durable checkpoints and exact receipt verification remain in place.
Provider/wallet hooks restore in `finally`; late submission methods check the
retired lease. An unresolved SDK execution retains its resource and quarantines
replacement rather than creating an overlapping signer.

Local logout does **not** await settlement. Warning checkboxes remain
informational/non-gating, including unavailable warnings. Deliberate selected-
profile local cleanup is distinct from ordinary retirement's journal retention.
Old send/delivery/continuation callbacks cannot recreate removed journals.
Neither logout nor a timing measurement asserts network cancellation or success.
Admin Reset and the standalone runner's joined-session guards remain separate.

## Requirement-to-evidence mapping

| `app-wallet-session` requirement | Implementation and verification |
| --- | --- |
| Bounded role ownership | `app-wallet-session.ts`; lazy two-role and independent-app factory tests, cross-feature retained-adapter sequence. Public Marketplace inventory remains `RestIndexerProvider`-only. |
| Reuse across reads/navigation | Bound context/Game dependencies; stable identity/network/eligibility triggers; ten repeated balance/assets reads and unchanged-Player-publication Game regression. |
| Role lifecycle/generation isolation | Monotonic role generations, retirement quarantine, root/storage/network/disposal wiring; A-B-A, late completion, readiness-race, wallet-scope/role and logout tests. |
| Bounded acquisition/recovery | Shared pending initialization with caller detachment, deadlines and one cleanup owner; first-caller cancellation, failed-then-successful creation, late factory and hung-disposal tests. |
| Fresh live evidence | `complete-snapshot.ts`, per-attempt provider evidence; required indexer failures, missed old spends, inactive contracts, pagination, exact amounts, failure/recovery and independently failed history tests. |
| Complete assets/scoped metadata | Live quantities and validated network/operator/asset-keyed immutable metadata; large BigInt quantities, changed quantity, missing optional fields, cross-network isolation and required-lookup failure tests. Existing metadata/provenance tests retained. |
| Shared observation | One role source with external callback fan-out; opening/detaching/reopening consumers reuses one subscription, retirement stops callbacks and owns disposal. Shared-wallet-observer/activity-stall/Game-events regressions. |
| Transaction safety | Exclusive scoped signer methods, deterministic two-role helper, retained send/boarding/onboarding/mint/burn/delivery bindings. Reservation, policy, asset proof, receipt, payment, trophy and contract/LTO regressions; read-only factory tests count zero submissions. |
| Submitted operations/presentation cancellation | Caller detaches while actual SDK execution keeps its signer lane; quarantine/late-submit tests and send/asset cleanup regressions. Ordinary retirement does not erase operation records. |
| Deliberate logout without settlement | Non-awaiting retirement hooks and existing local cleanup; checked/unchecked warnings, pending/unknown operations and browser logout regressions. |
| Creation/restoration in role slots | `account.ts` uses the role candidate; successful-restore reuse and invalid-restore preservation tests, existing persistence/role-conflict regressions. |
| Private resources/existing UI | No private resource types in package declarations/entry exports; ephemeral repositories and unchanged public account API. Guest, readiness, loading/cache, identity and navigation regressions retained. React dependency review used for host compositions. |
| Standalone test-tool compatibility | Optional role capability preserves direct adapter entry points and independent bounded Node acquisition/use/disposal. Runner inventory, observation, exact receipt, operation-accounting, vault and joined-session regressions. |
| Verifiable warm overhead | Matched protected-fixture Node measurements below; ten forced-live samples per read/network, separately measured startup and display-cache phases, request counts and no extra warm constructions. |

## Construction audit

`rg` audited `Wallet.create`, `ReadonlyWallet.create`, and `withTemporaryWallet`
under integration source. Browser production composition always supplies the
private role capability. Its only SDK construction owner is
`wallet-layer-arkade/app-wallet-session.ts`.

Separate compatibility paths remain intentional: `account.ts`, `addresses.ts`,
`balance.ts`, and `funding.ts` use bounded standalone readonly verification;
`adapter-wallet.ts` bounds direct Node reads/signing for assets, sending and
boarding; `activity.ts` owns an independently bounded standalone observer;
`assets.ts` retains direct readonly list/event-observer paths; `onboarding.ts`
retains its injected/direct acquisition and cleanup contract. None is used to
construct an additional browser role wallet. LTO and receipt reconciliation use
providers/identity without constructing SDK wallets. Prototype and mocked test
factories have independent lifetimes and do not count as browser app resources.

## Matched read-only timing

2026-10-11, SDK 0.4.72, same registered protected fixture (`agent-player-1`),
network/operator/identity/explorer matched between BIS and the SDK prototype
comparator. Transport was **Node fetch**, not browser rendering. The prototype
comparator follows BIS in the same process; cold figures are separately recorded
phase timings, not a randomized, cache-equivalent startup experiment. The prototype
comparator follows the prototype's post-initialization balance and subsequent
metadata-only asset-label phases. Its asset label excludes ownership discovery;
that label is not comparable to a complete BIS asset inventory request.

| Network | BIS cold address/startup | Balance p50 / p95 | Assets p50 / p95 | Prototype balance p50 / p95 |
| --- | ---: | ---: | ---: | ---: |
| Signet | 1,159 ms | 169 / 350 ms | 91 / 103 ms | 101 / 476 ms |
| Mutinynet | 2,683 ms | 839 / 1,150 ms | 760 / 1,063 ms | 770 / 2,823 ms |

Each warm distribution contains ten forced-live samples, not display-cache hits.
Each network created/disposed one BIS wallet; warm reads added **zero** wallets.
Balance issued 30 requests per ten samples (10 operator-info, 10 complete
indexer, 10 explorer-address). Assets issued 20 (10 info, 10 complete indexer).
Requests overlap rather than adding their durations serially. Mutinynet indexer
requests averaged approximately 892 ms for balance and 817 ms for assets; their
tails dominate the observed remaining delay. Signet warm request-category means
were approximately 90–97 ms. Neither network guarantees subsecond tails.

Ten separately measured display-cache reads per data type/network generated zero
requests. Their p50 values were approximately 0.014/0.011 ms (Signet balance/
assets) and 0.016/0.016 ms (Mutinynet). These are production coordinator cache
hits, **not authoritative ownership or mutation authorization**.

Those matched fixtures held **zero assets**. A separate protected read-only audit
of all seven active registered fixtures across both networks located a real
two-asset inventory on `test-account-2` / Mutinynet. Its reported pending state on
that network was false; no existing pending record on either network was changed.

The additional asset-bearing matched run collected ten forced-live samples per
read: balance **943 / 1,582 ms p50/p95**, assets **905 / 1,484 ms p50/p95**. Cold
address/startup was 2,920 ms; the first complete metadata-cold asset read was
1,297 ms and made two metadata requests. Ten subsequent forced-live asset reads
made **zero metadata requests**, while still making ten complete ownership and
ten operator-info requests. They created zero new wallets. Display cache hits
again generated zero requests. The prototype comparator's balance p50/p95 was
175/2,363 ms; its metadata-only asset-label phase was 421/785 ms and made twenty
metadata requests. Unlike BIS's time-zero complete verification, the comparator
retains SDK incremental ownership/repository behavior; these freshness guarantees
are not identical. This explains why its warmer balance label can be cheaper
without establishing equivalent complete live ownership.

Asset-bearing evidence is in `asset-bearing-live-timings.json`; safe fixture
coverage counts are in `asset-fixture-coverage.json`, beside the original report.
No asset-bearing registered Signet fixture was available. Deterministic tests
additionally cover validated cache failure, cross-network isolation and large
quantities. No funded mint,
send, checkout, logout, storage clearing, package import, publishing, or vault
write was performed merely to collect timing data. Existing pending-onboarding
hold/receipt regressions were preserved; reported fixture pending state was false.

The secret-free sample report and benchmark are ignored artifacts under
`output/reports/retain-app-wallet-sessions/`. Reports contain durations, request
categories/hosts/statuses and safe counts, not phrases, addresses, payloads,
signatures, SDK objects, browser journals or raw private errors.

## Verification status

- Finalization recheck: the selected owner, retained-adapter, complete-snapshot,
  Game, continuation and logout-cleanup tests passed **72/72** with zero skips
  (`finalize-safety.log`), and `npm run typecheck` passed again.
- Sync validation passed for all **63 main specs**. Strict archived validation
  reports this change valid with zero issues; the repository-wide archive audit
  separately reports 12 historical archives with incomplete tasks. Those older
  archives are unrelated and remain untouched.
- Focused safety regression run: **275/275 passed**. Additional final retained-
  adapter tests: **12/12 passed**; Game/onboarding group: **45/45 passed**.
  Final combined owner, retained adapters, complete snapshot, Game, continuation
  and logout group: **77/77 passed** (`last-safety.log`).
- `npm run typecheck`: passed after the isolation/concurrency changes.
- `npm run build`: passed; final stable-boundary rebuild is tracked in
  `output/logs/retain-app-wallet-sessions/build-stable-boundary.log`. Existing bundle-size
  and dynamic-import warnings are not wallet failures.
- First reconciled full run: **940/944 passed**. The continuation cancellation
  and Marketplace prompt failures subsequently passed isolated reruns after
  reconciliation. Shared-server route/config tests were concurrently changing
  for the separate prototype-sandbox work; this change did not modify them.
- Final full run: **953/956 passed**, in
  `output/logs/retain-app-wallet-sessions/full-tests-final.log`. The three failures
  were background-cache navigation, protected typography and Swap browser
  fixtures: root Vite dependency-scan/transform and page-load timeouts under
  concurrent work, not wallet-safety assertions. An isolated serial Edge rerun
  passed background-cache and both typography tests, then reproduced a separate
  Swap fixture-only `favicon.ico` 404 console assertion (**3/4 passed**;
  `browser-rerun.log`). The separate fixture fix is outside this wallet refactor.
  After that fixture fix, the unchanged Swap assertions passed **1/1** in
  `swap-fixture-final.log`; all three full-run failures therefore have successful
  isolated reruns. This record must not be described as a clean full-suite pass.
- `openspec validate retain-app-wallet-sessions --strict`: passed. Scoped
  `git diff --check` passed, and generated entry declarations contain none of
  the new private resource/session/provider types.

No commit, package release/import or publishing was performed by this change's
apply workflow. Other chats have concurrently committed shared-checkout changes;
Git history is not evidence of independently requested release authorization here.
