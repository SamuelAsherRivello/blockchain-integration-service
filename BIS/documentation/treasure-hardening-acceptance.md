# Treasure BIS hardening and acceptance

This follow-up implements the separately authorized 2026-10-22 BIS phase. The
[bounded report](treasure-bounded-acceptance.md) remains the historical baseline.
The game import, onboarding, release and existing upstream negative-admission
and delayed-finalization blockers remain outside this phase. BIS is not yet
production-qualified.

## Current acceptance boundary

This table summarizes the latest owner checkpoint. Later sections preserve the
earlier failed attempts and their corrections; they do not override these
current dispositions or turn historical receipts into final-artifact acceptance.

| Remaining boundary | Current evidence | Required next step / stop condition |
| --- | --- | --- |
| Admin readiness | The first `harden-network-s1` preflight stopped unfunded. Diagnostics identified the overridden Bitcoin explorer as unreachable. After the SDK-default provider change, normal Admin `harden-net-read-s2` passed; the subsequently assigned original network-replacement case also passed its normal readiness and completed funding and Claim. | Reuse the completed case's receipts. Any different funded case still needs fresh normal readiness and a coordinated financial slot. The separate diagnostic wallet does not override Admin readiness. |
| Original identity/race case | Signet browser `harden-identity-s1` passed with exact funding/checkpoint/Player payout and protected identity binding. Both test operations are settled. Other configurations remain unperformed. | Reuse this pass. Do not repeat its funding or count it as another network/mode's proof. |
| Shared-adapter gate | Coordinator accepted the strengthened actual SDK selection comparison and reran seven tests successfully; shared runtime is frozen. | Keep it frozen during funded acceptance. This is local adapter evidence, not deployed/network qualification. |
| Live asset preservation | Independent wire/asset verifier is tested; no live asset-carrier funding pass. `harden-asset-mint-m1` remains unknown after its allowed original reconciliation. | Keep the mint reservation. No replacement mint or competing spend against that wallet. New diagnostic evidence is required before reopening it. |
| Actual network replacement and legacy rollback | Real Signet browser `harden-network-s1` now passes actual Mutinynet context replacement, wrong-scope action denial, unchanged journals, original restoration and exact original 1,000-sat Claim. Signet legacy rollback also passed. | Reuse these exact Signet/browser passes. They do not qualify other financial configurations, a historical user's recovery or covenant timing. |
| Funded UI responsiveness | Passive observer and trusted/untrusted wallet-free checks pass. The authorized original Signet feedback case stopped before funding twice at explicit unavailable readiness, with a real ready read-only check between them. | Blocked/unperformed financially. No feedback case journal, operation, input or live timing sample exists. Reopening requires new readiness evidence and a new coordinator handoff; one sample never qualifies p95. |
| Remote covenant qualification | Negative-admission and delayed-finalization proof remain blocked. | No repeated probes without new authoritative diagnostics or protocol evidence. Corresponding qualification stays unavailable. |
| Final BIS source gates | The earlier integrated snapshot passed 1,337 tests plus its typecheck/build/CSP/Pages/audit gates. The subsequent owner regression executed 1,382 tests: 1,380 passed and two failed. Typecheck passed before three server workflow/journal files changed during the run. The new Treasure regressions executed and passed. | The latest full gate fails and does not cover an unchanged final snapshot. Diagnose both failures, finish the server source freeze, then rerun the integrated gates. C094-T036 records only the earlier snapshot. |
| Game handoff | No game dependency import or gameplay implementation occurs in this owner phase. | Await verified BIS release/export/import handoff and original qualification/scope decisions. |

The five historical unknown operations remain protected. Identity/race, legacy
rollback and network-replacement runs are terminal and settled; both feedback
preflights are terminal and unfunded. The owner returned the funded slot after
the network-replacement case. That case verified all 12 reviewed source hashes
unchanged. Subsequent sections retain the earlier fixture-only and unfunded
checkpoints as history. New fixtures and the explorer configuration change need
inclusion in the next integrated run. No owner financial acceptance process
remains in flight.

## Controlled network isolation and legacy fixture assessment

The fixture-only follow-up adds `treasure-network-replacement-fixture.ts` and
`treasure-network-replacement.test.ts`. In a fresh wallet-free Chromium context,
the fixture seeds an explicitly synthetic contract through the production
ledger and encrypted IndexedDB storage. It changes the real network preference
and uses `createNetworkScopedContractStorage` with the actual LTO service.
Identical Player/Game profile IDs on both networks test network isolation
independently of identity differences. Signet-to-Mutinynet and the reverse both
hide the original contract and deny Claim, Reject and Refund. Session end does
not mutate the other network's journal. Returning preserves the full original
document, funding output and deadline. The fixture refuses populated journals.
All signing/provider dependencies throw if reached, and the browser test rejects
remote requests. These are deterministic service/storage assertions, not a live
network change, real wallet restoration or contract spend.

The focused run passes 12 tests, comprising this browser check and the 11
acceptance-policy checks. Evidence is
`output/reports/treasure-contract/hardening/network-replacement-final-focused-2026-10-25.txt`.
The initial sandbox launch could not access the installed host Chromium; the
host run passes. No shared server was restarted or protected browser opened.

A protected read-only vault inventory reports 26 Admin run summaries and six
proof-run summaries. The two incomplete Admin summaries have no recorded
receipts. Proof runs have Treasure parameters; a run's browser-policy mode or
completion flag alone cannot establish a genuine unresolved legacy output.
This inventory does not inspect every browser database or establish that no
legacy contract exists. It establishes no eligible original legacy fixture.
Only whitelisted public run metadata was emitted, to
`output/reports/treasure-contract/hardening/legacy-inventory-readonly-2026-10-25.json`.
No journal, reservation, recovery bundle or wallet was changed.

The unchanged game dependency is a possible source of a genuine controlled
legacy fixture. Its verifier passes archive SHA-256
`1ad3cdb15b4d67d23a42addedb921999aff30bde694f0bc6a5bb546995aceace`
and all 149 installed-file hashes for `bis-integration-0.0.23.tgz`. Its package
exports are the recorded development entry and built distribution, with SDK
0.4.79. Its actual `prepareLtoRecovery` creates a random secret and the old
four-leaf contract, without Treasure material. Its original adapter persists
funding/spend recovery. Current BIS reconstructs those legacy bytes and selects
the original refund leaf when Treasure material is absent. Both versions use
the network-scoped `bis-contract-recovery-<network>-v1` database. This source
comparison supports a setup proposal, not live compatibility or fundability.

Before any legacy fixture funding, the coordinator must assign a financial
slot, select registered isolated test wallets with no competing unknown spend,
and approve the immutable artifact's isolated harness. Resolve the package
through its verified archive/exports, never an adjacent source replacement.
Bind original profile IDs, network, operator, script, deadline, original request
and exact funding outpoint in protected storage. Confirm current operator/fee
compatibility read-only before spending. Use the old public factories to make
the record and output; do not remove validation fields from a new record or
forge recovery. Stop old monitoring with `dispose({endSessions:false})` and
close the old application before current-version recovery on the same protected
origin/profile. Preserve a protected original snapshot. With new creation
disabled, independently verify the exact existing output, original script and
one original refund receipt under current BIS. Stop and preserve reservations
on an unknown submission. Do not manufacture a legacy proof by moving funds
between ordinary wallets. A newly created old-version fixture would demonstrate
controlled legacy compatibility, not recovery of a historical user's contract.
No legacy harness was run, no legacy funding occurred, and no game dependency,
vendor file, production runtime or server setting changed in this follow-up.

### Executable protected paths, awaiting financial handoff

The subsequent fixture slot implements `network-replacement` and
`legacy-rollback` in `treasure-admin-live.ts`, with helpers in
`treasure-protected-browser.ts` and `treasure-protected-harness.ts`. Neither
scenario has executed financially. Both require
`BIS_TREASURE_FINANCIAL_SLOT` to equal the exact run ID, checked before wallet
access. Existing run IDs cannot start another attempt. Protected grant/pending
operation checks remain, and preflight requires rolling-day budget headroom
for both original funding and its payout, totaling 2,000 sats at the adapter's
required zero-fee policy. The normal ledger persists intents before submission.
An unknown result is not an invitation to retry or replace it.

Network preflight requires an already registered, saved and selected local
Player/Game pair on the other network, no unresolved contracts there, and no
reserved operation against either identity. It unloads only the owned Admin
document into a blank acceptance harness that retains the host's CSP headers.
Real public BIS factories must then read both network wallet bindings as ready,
and the original Game Wallet must have at least 1,000 available sats, before
creating a case or funding. The original Admin is restored before funding.
No phrases are restored, profiles deleted or account logout safeguards bypassed.

After real funding, the executable switch unloads the owned Admin again,
changes the production network preference and recreates real contexts against
the other network's saved wallets. This is a preference/remount transition;
the public in-place switch remains correctly blocked while a profile is
selected. Wrong-scope inspection, Claim, Reject and Refund must leave the
original hidden and both complete journals unchanged. A transport guard rejects
and counts provider POSTs except observational indexer requests. A violation
fails acceptance, rather than being reported as successful application denial.
The helper restores original selection, funding source, deadline and eligibility
before one original Claim. The normal independent receipt verifier must trace
the exact funding/checkpoint/payout. An observation timeout retains the guard
until browser closure, restores the original preference and preserves the
original financial reservation; it does not launch another action.

Legacy preflight verifies the fixed archive hash, derives the 149 file hashes
directly from that authentic archive, compares the inventory and installed files,
then bundles the actual immutable distribution export with its React production
definition into ignored output. It rechecks the installed hashes after bundling.
The bundle must be self-contained, and its hash/provenance is persisted before
funding. The old public factories must verify actual original wallet bindings,
readiness and at least 1,000 available sats before allocating the case. One old
public Start creates the genuine original contract and private recovery. Its
controller is stopped with `endSessions:false` after verified funding, and the
unaltered private document is saved directly into the protected vault. Current
BIS must inspect that original with creation disabled, deny replacement creation
and request the original refund. Exact linked network receipts remain required.
The recovery record must actually lack the old version's validation field and
Treasure material; no current record is relabeled. Duplicate old Start and
duplicate current action guards precede asynchronous work.

Wallet-free checks verify archive/export/origin refusal, executable run-ID
denial before wallet access, the old distribution's actual public exports,
single-attempt behavior after a controlled thrown acknowledgement, and the
existing network-isolation/policy checks. The initial bundle import exposed an
undefined React `process.env.NODE_ENV`; the build now supplies the normal
production definition. That failed log is retained. These checks do not call a
protected wallet or establish actual fixture readiness. Both scenarios' live
eligibility is **not yet observed** and can fail closed at their normal preflight.
No funded slot, new legacy output, network-switch receipt or acceptance waiver
is implied by executable fixture preparation. T034/T035 remain open.

The final focused command runs the acceptance policy, protected harness and
network-replacement test files together. All 18 checks pass in
`output/reports/treasure-contract/hardening/protected-harness-archive-bound-final-2026-10-25.txt`.
The immutable distribution bundle hash is
`e842cd1172f67f1c18e592be4390ac029758072e25c6d16c8f700c67db636b73`.
The runner and both protected helper modules also pass Node syntax checks.
These source changes require coordinator review and subsequent integrated
verification. The earlier 1,337-test snapshot does not cover them.

### Pre-funding review correction: legacy document transition

Coordinator review found a real runner defect before funding: the common
post-funding assertion still queried the Admin signing selector after the legacy
case had replaced that document with its blank harness. The legacy branch now
uses `verifyFundedAcceptanceMode` to stop the old controller without ending its
session, validate pinned artifact provenance and capture the actual private
original directly into the vault. Capture checks field absence, network,
Player/Game/session identity, deadline, 1,000-sat original outpoint and compiled
four-leaf script via `inspectLtoRecoveryDescriptor`. Other Admin cases retain the
disabled-selector assertion. The legacy branch's later operations use factories
and storage rather than Admin locators; source review found no further common
Admin-control wait on that path. Ordinary `bound()` mode checking is unchanged:
current public inspection correctly projects an absent stored legacy mode as
`browser-policy-v1`, without adding that field to the private record.

`treasure-legacy-transition.test.ts` now navigates an isolated wallet-free page
from its controlled disabled-selector document into the actual blank harness,
then runs the same post-funding verification helper with deterministic legacy-
format data. The compiled builder is byte-identical to the verified archived
old builder. Real encrypted storage and current inspection preserve absent
private mode/Treasure fields, expose the public fallback and retain recovery
eligibility. Wrong script, deadline, Game identity and funding source are denied
without journal mutation or remote requests. The test also preserves the normal
Admin assertion against an editable selector and restores its original document.
This is format/DOM regression coverage, not a genuinely funded old contract.
The initial 1,500 ms cold-navigation timeout is retained in the failed log;
navigation now uses the normal 30-second bound while missing-control detection
remains short. The final combined run passes all 19 checks in
`output/reports/treasure-contract/hardening/legacy-transition-final-focused-2026-10-25.txt`.
No protected wallet was opened and no live scenario ran. Review/source hashes
must be refreshed before a financial handoff. T034/T035 remain open.

### Real Signet legacy original and current-version refund

After the coordinator's explicit exclusive handoff, `harden-legacy-s1` passed
using Node 24.21.0, the reviewed frozen source, registered `treasure-signet-pair`
and the existing protected browser. Current Admin readiness and old-version
wallet preflight both passed before funding. Actual immutable 0.0.23 factories
created contract `6a5fecc1-3ba2-4e97-ab57-4915f0f3ca27`; no current record was
reclassified. The original window was 89,132 ms, using the approved deadline
rounded down to whole seconds. The private snapshot preserves absent stored
validation-mode/Treasure fields, original funded state, identities, terms and
funding outpoint. It remains in the protected vault. Current BIS recompiled the
original legacy script, denied replacement creation and refunded the original
output with creation disabled.

| Exact original chain | Transaction and output |
| --- | --- |
| Legacy contract funding | `55da5616f51e30d292194a41fa53d2fcb5f247552b08db6656f64c3934138c22:0` |
| Linked checkpoint | `8500f17bec1d7a9c45b07551e19b14ea0c35b3f1dc2444ff63fabbbecfe9c208:0` |
| Original Game Wallet refund | `dc53bae0c49562cacc0087833f1abac465d2ac3295a6d7132fc9f1cc73a05b1e:0` |

The refund is an asset-free 1,000-sat output at the original Game Wallet script.
Both protected test operations are settled at 1,000 sats and zero fees each,
so this case counts 2,000 sats toward the rolling budget. The runner exited 0;
all nine owner source hashes still match. A read-only final vault disposition
confirms the exact original identities, deadline and old recovery structure.
The same five historical unknowns remain protected; no original reconciliation,
replacement funding, faucet, onboarding or alternate case was needed. The
coordinator independently re-fetched and verified the exact network chain.

Owner evidence is `legacy-signet-original-2026-10-25.jsonl` and
`legacy-signet-final-disposition-2026-10-25.json` under
`output/reports/treasure-contract/hardening/`. Independent evidence is
`output/reports/bis-server-treasure-release/legacy-receipt-independent.json`.
The sole financial slot is returned. This proves controlled genuine old-version
Signet/browser creation-disabled recovery only. It does not prove historical
user recovery, another network/mode, live network replacement, covenant timing
or the imported game. T034/T035 and the original broader qualification gates
remain incomplete.

The coordinator's next read-only network-fixture assignment completed in the
same protected Signet browser. None of eight registered Mutinynet pair candidates
has a saved/selected Player or local Game Wallet there; no Mutinynet unresolved
contract was found. Candidate pairs using the primary Mutinynet Game Wallet are
additionally excluded by the preserved unknown asset mint. The registered
`treasure-empty-game-mutinynet` pair has no conflicting operation in this
inventory and is a possible nonfinancial preparation candidate. It still fails
saved-profile/selection preconditions. No profile was restored or registered,
no network switch was performed and no financial action occurred in this check.
The owned read-only runner closed and exited 0.

Exact public metadata is in `network-fixture-eligibility-2026-10-25.json` under
the owner hardening output directory. The separate
`network-fixture-preparation-proposal-2026-10-25.json` proposes normal encrypted
Mutinynet restoration of that existing registered pair in the same protected
browser, fresh grant/conflict checks and preservation of the original Signet
selection/journal. It is proposed only, not executed or implicitly authorized.
It requires no funding, mint, faucet, onboarding, fabricated registration or
wallet transfer. Even successful preparation would not authorize or prove the
later live network-replacement case.

The coordinator then explicitly approved that nonfinancial preparation. Real BIS
restore APIs saved the two existing registered Mutinynet identities into the
same owned browser's encrypted network-scoped storage. Both derived IDs matched
the approved registration; no new key or registration was created. The original
Signet Player, Game Wallet and full contract journal compared unchanged, and its
network preference was restored. The first preparation report remains failed:
the conservative backstop blocked two POSTs despite successful restoration.
An unchanged strict-guard read-only diagnostic identified both as the exact
local `/api/bis/connect` path. Neither failed report was rewritten as a pass.

Source evidence distinguishes connection metadata from signing: integration
`server-wallet.ts` sends the connection probe; bis-server `server/vite.ts`
dispatches `/connect` to `signer.connect`, whose `server/signer.ts` implementation
returns public identity and an expiring connection token without transaction or
message signing. The hosted implementation also explicitly separates connection
from signing authorization. After reviewing that source, the coordinator allowed
only `POST http://127.0.0.1:5174/api/bis/connect` in a new temporary read-only
verification. All other signing/financial API POSTs remained blocked; the
existing observational indexer exception remained. No tracked source changed.

That new verification passes without restoring either wallet again. The actual
Mutinynet Player/Game bindings match, the Game Wallet is `ready` on the `manual`
source, storage eligibility is true and contract creation is disabled. The two
real metadata responses are 404, accurately indicating that the local signer is
absent; no metadata response or financial outcome was fabricated. No financial
POST passed or was attempted in this verification. Read-only production parsers
find zero unresolved sends, boarding, mints, burns, deliveries, migrations,
continuations, onboarding, contracts or active reservations across the original
Signet pair and prepared Mutinynet pair. Two historical onboarding records are
complete and nine original Signet contracts are resolved. Original Signet
Player/Game/journal comparisons pass, preference is restored and all nine frozen
source hashes match. The owned verification runner exited 0.

The preserved failed reports are `network-fixture-preparation-result-2026-10-25.json`
and `network-fixture-preparation-diagnostic-2026-10-25.json`; the new successful
read-only result is `network-fixture-connection-verified-2026-10-25.json`, all in
the owner hardening output directory. Preparation/readiness is now established
within that protected fixture. Actual network-replacement funding/spending is
still unperformed and requires a new exclusive coordinator handoff. No faucet,
onboarding transaction, mint, transfer, new funded case or game import occurred.

## Host policy and dependencies

`BIS/scripts/content-security-policy.ts` applies CSP to the shared development
host, package development/preview configurations and production HTML. Staging
also protects copied launcher HTML and generated redirects. Development HTML
gets a fresh random nonce per response. Built inline redirect scripts use exact
SHA-256 hashes. Arbitrary inline JavaScript, event attributes, JavaScript eval,
foreign scripts and object embeds are not allowed. WebAssembly compilation is
allowed for SDK compatibility. Existing inline CSS and HTTPS asset images remain
allowed. These permissions are not a claim of same-origin signing isolation.

Connections allow the configured Arkade operators, co-signer, Bitcoin explorers,
repository metadata, same-origin APIs and the existing local Conditional Vault
endpoints. Development additionally allows loopback WebSockets for Vite.
Deployments using another hosted signer or metadata service must set the public
`BIS_CSP_CONNECT_ORIGINS` environment variable before starting/building/staging.
It accepts comma- or whitespace-separated HTTPS origins, or HTTP loopback
origins. Credentials, paths, queries and CSP directives are rejected. Configure
only required origins, not secrets. Runtime `configureBisServer` does not grant
a new browser CSP permission. Browser-only test transports declare their fixture
origins explicitly rather than weakening production policy.

Static HTML uses a CSP meta tag because a Pages artifact cannot set arbitrary
response headers. The Vite development/preview server additionally sends
`frame-ancestors 'self'` and `X-Content-Type-Options: nosniff`. A deployed host
needs its own header configuration for those protections. No public deployment
or deployed-game security qualification has been performed.

The affected installed chain is Mermaid 12.2.0, DOMPurify 3.4.17 and KaTeX
0.18.10. The production-dependency audit reports zero known vulnerabilities.
This is a targeted dependency fix, not a claim that every dependency is latest
or that an audit proves absence of vulnerabilities. Arkade SDK remains pinned
at 0.4.79.

## Verified checks

- All package builds passed after the nonce, endpoint and standalone-entry fixes.
- Production-prefix Sandbox build, Pages staging and real-browser route checks
  passed. They cover Admin, Marketplace, all 21 Sandbox diagrams, Events popup,
  assets and seven legacy Slidev redirect trees. The earlier route assertion
  failure was caused by building Sandbox with its default relative base instead
  of the CI deployment prefix.
- Five CSP tests passed, including real-browser script blocking, distinct
  response nonces, required application scripts, sanitized Mermaid output,
  authored inline hashes and copied/static entry coverage.
- Four acceptance-runner policy tests passed. They reject unsupported selections,
  prevent a second attempt under an existing run ID, preserve the original mode
  during recovery and show that observation timeout neither cancels nor repeats
  the original operation.
- Root typecheck passed after adding the acceptance helpers. Scripts are outside
  the root application TypeScript include, so this is not a claim of exhaustive
  script typechecking.
- The protected Signet browser preflight passed against the newly coordinated
  local server, without funding or submission.
- The Admin Claim handler guards the complete inspection/action sequence,
  immediately disables conflicting Start/Claim inputs and exposes an accessible
  busy message without moving the buttons. A stale handler cannot clear a newer
  handler's busy state. A desktop/mobile deterministic browser test passed with
  blocked inspection, duplicate clicks, one eventual action and no false
  unavailable toast. This is not live contract proof or funded latency p95.

Sanitized command results are under
`output/reports/treasure-contract/hardening/`. They are generated evidence and
are not committed. Real wallet phrases, signing material and recovery bundles
stay in protected storage, never in this report directory.

## Acceptance runner and remaining work

The existing protected `BIS/scripts/treasure-admin-live.ts` runner now supports
`duplicate-claim`, `empty-duplicate-claim` and `session-rollback`. An optional final
pair label selects a registered fixture without replacing existing pair records.
The empty-player case requires a fresh live zero-total balance before funding
and sends two Claim click events through the normal Admin controller. No success
projection or provider response is fabricated. The session case uses the actual public BIS
factories with creation disabled, checks the original funded descriptor, denies
replacement creation and a foreign contract ID, checks the selected-profile
network-switch safeguard and requests the original session end twice. It then
verifies the exact contract/checkpoint/1,000-sat Game Wallet refund. The network
switch safeguard is not a test of an actual identity/network replacement.
Creation-disable testing of a current contract does not prove legacy rollback.

Example commands, only for registered, authorized test wallets:

```powershell
node BIS/scripts/treasure-admin-live.ts browser session-rollback <fresh-run-id> signet
node BIS/scripts/treasure-admin-live.ts browser duplicate-claim <fresh-run-id> mutinynet
node BIS/scripts/treasure-admin-live.ts cosigner session-rollback <fresh-run-id> mutinynet
```

Every funded run persists its protected ledger before submission. An existing
run cannot be used for a new attempt. Recovery uses `recover` with the original
mode, run ID and network. An observation timeout does not mark failure, release
reservations, authorize fallback or launch replacement funding.

### New live receipts

| Configuration | Original funding | Verified original refund |
| --- | --- | --- |
| Signet browser, `harden-session-s1` | `5f0980745cbcf6dc797d2da397f0be027932b1b2ca58d58e0691883df67401fa:0` | `e27b4421eb1401931f58b4e35452a768bcdbb0cd57478dccf1808d324380995c:0` |
| Mutinynet browser, `harden-session-m1` | `65ea705f3e0e9c15e826a366b7432197c7bb2c58a10218bfe5274119d9d421b0:0` | `8626ed3c4ecb93b80b042572c67ff001eb1666aef3dae46a96f39933dc9e864f:0` |
| Mutinynet co-signer, `harden-session-c1` | `fc1d066efb164dc2bbba3ea40dc52a7224c0f31df2ba999fbf9443c1091d2aa8:0` | `da40b70efb73c92fb2e0f0a9742135a4595188f87ddf14a4e83ebc531ee6e7a0:0` |

All three runs passed the window-close, creation-disabled current-contract recovery,
wrong-contract denial, selected-profile network-change safeguard and duplicate
session-end assertions. Each payout was traced through the exact original
contract and checkpoint to an asset-free 1,000-sat Game Wallet output. Their
protected funding and refund operations are settled. This is not proof of
legacy rollback, a real identity replacement, or a claim/refund race.

### Empty-player claims

Fresh protected Player Wallets began with live-verified zero Bitcoin, Arkade
and total balances. Each run sent two Claim events through the normal Admin
controller and verified one original contract/checkpoint/1,000-sat payout.
Funding and Claim operations are settled. No faucet or onboarding was needed.

| Configuration | Original funding | Verified original Claim payout |
| --- | --- | --- |
| Mutinynet browser, `harden-empty-m1` | `e195830574c7939bba7aed3fef8b584c0e18390155831c2817daf0ad3fc90b09:0` | `0d4382f3f99d1379a43d967553586c686288f1c4cb71b15d345d370a1dee3092:0` |
| Mutinynet co-signer, `harden-empty-c1` | `a6a1da840433c770fcb221ea649392002be10521ed415ee6addd3be58dd943c0:0` | `e5bffcbf34e6c0009c2a5f7083833c0e7209b015c183afa2e0a0f6abd601f0ea:0` |

The post-feedback-fix full regression passed all 1,320 tests. A later saved
full run passed 1,324 tests after the additional runner/evidence tests. The missing-case matrix still needs
asset-carrier funding/change,
actual identity replacement, legacy rollback and funded-action latency. No
unperformed case is passed by this document or by the runner guard tests.

The first new full run recorded 1,317 passes and two failures out of 1,319.
Both failures were browser fixtures using undeclared synthetic signer origins.
After explicitly allowing those origins only in the fixture environment, all
four affected browser tests passed. The subsequent full-suite rerun passed
1,319 of 1,319. After the Admin feedback fix and its new desktop/mobile test,
the final run passed 1,320 of 1,320, recorded in `full-tests-final.txt` under
the report directory. Deterministic runner guards are not financial acceptance.

The browser-only lost-acknowledgement fixture is implemented for the missing
Mutinynet browser case. It forwards an actual finalization request with transport
retries disabled, drops one successful real response and forbids a second claim
submission or changed finalization payload. The production recovery path must
establish the exact original receipt. It never substitutes a fabricated operator
response. Run `harden-lost-m1` passed with one successful finalization response
dropped, one claim submission and one finalization call. Production recovery
verified the original contract/checkpoint/payout without another submission:

- Funding `a3dfac8047aaf1203ad05bd55fe3cd839ef78a50e2c7120601117882f6458853:0`.
- Checkpoint `a569998f4b32b628d396b97d7eede4acffb02a6c445a09c983c1d02c18e93f5b`.
- Player payout `9c3cdd79ae95758e9d62295456addbbc02005335e5a3593b724271bfccce822d:0`, exactly 1,000 asset-free sats.

This proves recovery after a lost finalization response, not remote admission
timing, loss of every possible response, or delayed-finalization enforcement.

## Current verification and reservations

After the Admin fix, root typecheck and all package builds pass. Production
Pages staging and browser route/diagram/redirect checks pass again. The dependency
audit remains zero known production vulnerabilities. Builds retain existing
large-chunk warnings; funded latency and game loading are not qualified by a
successful build.

The protected journal review confirms all six new funded runs completed with
two exact receipts each. No new treasure reservation remains unresolved. Four
unrelated pre-existing unknown operations remain protected and untouched:
`agent-player-signet-fund-1`, `cv-signet-fund-b`,
`vault-mutiny-proof-d-increment-1`, `vault-mutiny-local-a-increment-1`.
Their unknown outcomes are not treated as failures or cleared to make these
checks pass. The new Player Wallets and their real payouts remain in protected
test storage.

Current evidence commands, from the repository root:

```powershell
npm test
npm run build:all
npm audit --omit=dev --json
npm run build --workspace @spike/prototype-sandbox -- --base=/blockchain-integration-service/prototype-sandbox/
npm run stage:pages
npm run verify:pages
```

These regression commands do not themselves authorize another financial run.
Reuse the receipts above. New live cases keep the original one-attempt limit
and recovery rules. C094-T033 is complete; T034-T036 and production qualification
remain incomplete. The game dependency, game runtime, game release and onboarding
were not changed by this phase.

The previous shared-server process and API were verified absent. The coordinated
startup helper started the normal fixed-port services and verified all eight
declared routes with HTTP 200. No existing server was stopped or replaced. The
current frontend instance is `888c70ae-302e-4859-8ad6-ef6e8a952058` on 5174.

## Interrupted acceptance and source-commit handoff, 2026-10-23

This records the interrupted run, not completion of production acceptance.
Cleanup performs no spending, minting, onboarding or new wallet reconciliation.
Historical server identities above are not a claim that those processes still run.

Insufficient funds passed on all three configurations using a registered empty
Game Wallet. Each case required a live zero balance, the actual BIS record
`financial: failed`, `submission: not-submitted`, `failure: insufficient-funds`,
no funding/payout transaction ID and zero attempted financial POSTs. The test
backstop would block and fail any attempted submission, not count that blocked
request as an application rejection. Test-only prepared reservations were then
cancelled. Original case IDs are `harden-empty-game-s1`, `harden-empty-game-m1`
and `harden-empty-game-c1`.

The first Mutinynet readiness observation ended before the production read's
two bounded 30-second attempts could finish. A separate read-only SDK check
proved zero sats/assets. The runner observation budget was corrected to 75
seconds, with explicit unavailable results failing immediately; the same
unfunded case then passed without replacement funding.

The old Mutinynet asset carrier
`602bb0dd4a3bc696ce3d86b0166c31140644424bc14676f64cf238f0e59ca542:1`
was observed swept. The setup transfer `harden-asset-setup-m1` stopped at its
precondition before transferring or reserving funds. It was not contract proof.
A subsequent real test-asset issuance, `harden-asset-mint-m1`, returned an unknown
acknowledgement. Its one original-only reconciliation also returned unknown.
That mint reservation and its protected browser/production journal must remain
intact. No replacement mint or competing Game Wallet spend is authorized by
this handoff. This is a new setup blocker, not an upstream rejection proof.

The asset-funding fixture and independent wire/index verifier are implemented.
Three deterministic tests cover exact bigint quantities, original source and
checkpoint binding, asset-preserving change and rejection of altered evidence.
No live asset-funding pass is claimed. Signet asset setup and actual identity
replacement, competing Claim/refund, legacy-format rollback and funded-action
latency remain unperformed. Existing remote negative-admission and delayed-
finalization blockers remain unchanged and were not retried.

The latest saved full suite is `full-tests-current.txt`, 1,324 passes and zero
failures. A fresh cleanup typecheck also passes. Those are combined-worktree
results, not evidence that blocked financial checks passed or that every scoped
commit has independently been tested. Source commit cleanup leaves C094 and
T034-T036 incomplete. The game import/release stays separate.

## Acceptance observation corrections, 2026-10-23

The readiness parser now reads only the complete latest `A.G.3 Wallet Status`
JSON object. A nested `ready` field, an unrelated later log entry, truncated
JSON or an overwritten log cannot make a loading or unavailable wallet ready.
The protected browser runner uses that same tested parser rather than a broad
regular expression over the remaining console text.

The asset-issuance fixture previously inherited the generic scenario helper's
five-second acknowledgement observation. That is too short to observe an
original operation that is still preparing or submitting. The fixture now
requests a bounded 115-second acknowledgement observation within its existing
120-second outer observation limit. The ordinary helper default remains five
seconds. Limits are validated before private context access. Both a wall-clock
deadline and an attempt cap bound the observation, and no additional confirm
action is issued when an acknowledgement arrives late.

This corrects the harness for future eligible cases. It does not prove the
reason for `harden-asset-mint-m1`'s unknown result, resolve its journal, authorize
another mint, or reset its one-original-reconciliation limit. No wallet action
or reconciliation ran during this continuation.

Verification passed 33 deterministic tests in
`runner-observation-tests-host.txt` and one fresh wallet-free browser check in
`runner-readiness-browser.txt`, under the existing report directory. The first
sandboxed synthetic-vault run could not perform atomic temporary-file renames;
the host run uses disposable encrypted fixtures, not registered test wallets.
The historical full-suite result remains 1,324 passes; a new full-suite result
is not inferred from these focused checks. No task checkbox or financial
qualification was advanced by the observation fixes.

## Active-identity and competing-action fixture

`identity-race` is implemented in the protected Admin runner. Before funding,
it requires a distinct already-saved profile whose identity has a current test
grant and no pending operation on the selected network. It does not silently
create a profile, copy a private key into a public descriptor, modify an existing
contract or call a financial command to manufacture readiness.

For an eligible funded original, the fixture selects the alternate saved profile
through the actual public BIS context, checks that the original contract is
hidden and Claim/Reject are unavailable, and selects the original profile again.
It then sends competing production Claim/Reject commands for the exact original
contract. Acceptance requires an exact contract/checkpoint/payout chain to the
winning bound destination. A refund winner records the claim as failed, never
as a successful reward. Unknown outcomes retain the original operation and
reservation; no second contract or fallback is created.

Run `harden-identity-s1` on Signet stopped at `identity-fixture-unavailable`
before a case journal, funding reservation or contract was created. A distinct
eligible saved profile was absent. This is missing controlled fixture setup,
not evidence that active identity replacement or the competing race passed.
The Mutinynet wallet with the unknown asset mint was not used. Preparing a
registered alternate profile and proving an original-selection round trip are
required before running this new financial case.

The corresponding pre-funding guard and the observation/asset-evidence checks
pass 34 deterministic tests in `runner-current-tests.txt`. The wallet-free CSP
browser check remains a separate pass. Script syntax checks pass. The broader
financial acceptance and T034-T036 remain incomplete.

The previous shared frontend was confirmed absent. The coordinated launcher
started the fixed-port services and verified all eight declared routes with
HTTP 200, without replacing an existing listener or changing wallet storage.
The verified frontend instance for this continuation is
`afeac0cf-dff3-45ad-93d1-a71b4b24f040`, port 5174. Startup did not request
funding or onboarding. No cleanup commit, deployment or game import ran.

## Protected acceptance continuation, 2026-10-25

The coordinated release program owns root regression/build/release gates. This
owner retains Treasure fixtures and the sole funded test slot until the current
case is terminal. No server lifecycle, server signing, game import or publication
action ran here.

A fresh sanitized protected-ledger inspection found no original
`harden-identity-s1` case or operation. The four historical unknown operations
and `harden-asset-mint-m1` remain unknown and reserved. No new reconciliation,
replacement mint or competing Mutinynet Game Wallet spend ran.

The nonfinancial `harden-profile-s1` setup passed after recovering its interrupted
profile selection through the actual public BIS context. The registered alternate
profile is saved and the original profile is selected again. The setup used the
normal protected restore UI and never created a payment, contract or mint.
Early setup observations failed, including an unrelated Account-dialog reopen
timeout; those are not financial failures or identity/race passes. Final setup
verification checks actual context and storage rather than requiring that extra
dialog navigation.

The still-unfunded identity/race attempts exposed an observation defect. The
installed Playwright predicate poller treats an asynchronous callback's Promise
as truthy before its result resolves. A loading or undefined first observation
therefore ended the wait. A separate later console read also could substitute
a different background result. Inspection of the installed poller established
the first cause; a first fix that only retained its handle was insufficient.
The runner now explicitly awaits each browser read and returns its exact terminal
status. A timed-out read cannot start a second read. The production
funding/signing checks remain authoritative. Eleven policy tests and one
wallet-free real-browser test pass with the current change. The browser test
covers module loading under CSP and loading-to-ready asynchronous observation.

The Treasure runner now checks newly prepared reservations atomically inside
the protected vault transaction. It permits at most 5,000 sats per operation,
including fees, and 10,000 sats per network over a conservative rolling 24 hours.
Reserved, unknown and completed operations all consume that budget. Missing fee
or timestamp evidence fails closed. Old operations are not modified or forgiven.
These are test-runner limits, not a new product fee policy.

The corrected readiness observer reached a real pre-funding observation timeout.
A separate read-only probe verified a visible disabled Details control, without
a server-configuration-error banner. The initial-control wait now allows the
same bounded startup read budget instead of Playwright's shorter default.
None of these stopped attempts created an identity/race contract or reservation.

An independent wallet-free reproduction then exposed an Admin defect that can
replace readiness logs and repeat provider reads: the boarding-read effect
depends on an inline reporting callback that the parent recreates after each
report. A failed read triggers another parent render and another immediate read.
The failing baseline made 319 reads and 319 reports before the assertion,
instead of one before the normal 15-second poll, and logged React's maximum
update-depth warning. An earlier fixture attempt failed its missing HTML-head
CSP prerequisite and is not counted as a reproduction of this defect.

The scoped fix in `GameWalletPanel.tsx` keeps the latest reporter in a ref and
removes callback identity from polling dependencies. Controller, mode, profile,
wallet status and boarding-busy changes still restart the effect normally.
The existing concurrent server/manual wallet presentation remains untouched.
This is a reproducible Admin read-feedback fix, not a relaxed readiness check.
Both post-fix browser regressions pass serially: the read-error reproduction
performs one read/report, and the existing desktop/mobile Treasure duplicate
Claim/busy-feedback regression remains green. Evidence is in
`output/reports/treasure-contract/hardening/readiness-feedback-serial-2026-10-25.txt`.
The first parallel verification timed out during navigation before assertions;
it is not a passing result. The coordinator's final integrated regression/build
must include this UI fix and the new test, rather than reuse an earlier snapshot.

### Terminal pre-funding disposition and wallet-slot handoff

The final corrected `harden-identity-s1` process exited after
`observe-game-readiness` reached its 75-second limit. It did not establish a
terminal ready result. This remains a readiness-observation blocker; it is not
proof that the operator rejected a contract, a diagnosis of the underlying
provider failure, or evidence of an identity/race pass. No further funded
attempt is planned without new readiness evidence.

A final protected-ledger inspection confirms the profile setup completed, the
identity case does not exist, no operation was created in the last 24 hours,
and the same five historical unknown reservations remain unchanged. The
acceptance process is terminal. The Treasure owner releases its exclusive funded
wallet-test slot to the coordinator. This does not release any wallet reservation
or authorize a competing spend against the unknown Mutinynet mint. Sanitized
evidence is `output/reports/treasure-contract/hardening/protected-disposition-2026-10-25.json`.

No pass, new receipt, task completion or production qualification is inferred
from the setup and observation fixes. Existing negative-admission and
delayed-finalization blockers remain unwaived. Live asset-preserving funding,
identity/race, actual network replacement, legacy rollback and funded-action
latency remain incomplete. T034-T036 remain open, and game adaptation awaits
the coordinator's verified release/import handoff. The proposal cannot reach
`all_done` under its current required proof gates without stronger evidence or
an explicit human-approved scope revision.

## Readiness isolation and explicit-result retention, 2026-10-25

The new `readiness` scenario in `treasure-admin-live.ts` exercises the actual
Admin Details read and explicitly skips case creation and every financial
command. Fixed public diagnostic flags and request statuses distinguish a
terminal unavailable result from a missing/overwritten result. Request metadata
omits queries, request/response bodies, headers and dynamic address/outpoint path
segments. These probes do not reconcile the five protected unknown operations.

The first read-only probe captured a real `unavailable` Wallet Status. Its later
console snapshot no longer contained that result. This proves observation loss,
not that every failure was a logging defect. A subsequent browser trace recorded
successful operator responses, mixed explorer responses/cancellations and no
detected CSP connection block; it does not establish the cause of each failed
request or remote contract rejection.

`treasure-readiness-read.ts` compares the official SDK ReadonlyWallet, standalone
BIS balance adapter, and actual retained BIS read path. All three fresh Node
reads return 2,000 available Signet sats with zero boarding balance. A separate
fresh browser receives only the registered wallet's compressed public key and
also verifies 2,000 sats through the official readonly SDK, online/live, without
request failures. No phrase or signing identity enters that fresh browser.
The protected-browser public BIS controller independently returns `ready`,
manual source, the exact expected player/game/network bindings, addresses and
2,000 available sats. These are read results, not a new financial acceptance pass.

Initial comparison-harness failures were local setup errors: a missing await on
the readonly identity conversion, and use of `getPublicKey` instead of the SDK's
documented `compressedPublicKey`. They are not SDK/network failures. Corrected
results are in `readiness-retained-comparison-2026-10-25.jsonl`,
`readiness-fresh-browser-fixed-2026-10-25.jsonl`, and
`readiness-public-controller-2026-10-25.jsonl` under the existing report directory.

A wallet-free regression using the actual Admin App reproduces a second UI
defect: an asynchronous boarding error replaces the explicit Details result in
the console, including a valid terminal ready result. Only Game Wallet reports
now append to a bounded 20-entry history, matching the existing contract-control
pattern. Other asset console actions retain their prior replacement behavior.
The regression fails before the fix and passes afterward. Three current serial
browser checks pass: result retention, bounded read-error polling, and the
desktop/mobile Treasure duplicate-Claim feedback regression. Eleven policy tests
also pass. The coordinator's integrated source gates must include the App change.

The live Admin read-only recheck is separate from the funded identity/race case.
The funded slot remains with the coordinator. No new funded run, slot reacquisition,
upstream negative-admission probe, onboarding, game import or publication is
authorized by these read-only results.

### Ready for serialized funded-case handoff

`harden-readonly-s3` passed against the real Admin after the console fix. It
captured `gameReadiness: ready` and `verifiedReadiness: true`, with zero financial
actions. The process exited successfully. Evidence is
`readiness-after-console-fix-2026-10-25.jsonl` under the existing report directory.
The public BIS controller and public-key-only browser SDK reads are separate
corroborating checks. Earlier unavailable observations remain historical failures;
the new pass does not change or fabricate their outcomes.

The readiness reopening condition is now satisfied. The original
`harden-identity-s1` remains unfunded and has no case/operation journal, rather
than an unknown financial result. The coordinator must hand the exclusive funded
slot back before this owner runs its single real attempt. Do not launch a
parallel owner or a replacement ID. Existing grant caps and unknown reservations
remain in force. This handoff does not waive the separate upstream proof gates.

Read-only reproduction commands, requiring the existing protected test grants:

```powershell
node BIS/scripts/treasure-admin-live.ts browser readiness <fresh-run-id> signet
node BIS/scripts/treasure-readiness-read.ts --browser
node BIS/scripts/treasure-context-readiness.ts
```

The retained read comparison uses the normal BIS ephemeral wallet with automatic
settlement disabled, invoking only balance reads. The fresh SDK browser receives
only a compressed public key and uses readonly identity/repositories. No test
recovery phrase, signed request or exported recovery material belongs in reports.

### Shared-adapter serialization boundary

The coordinator briefly returned the funded slot, then requested a hold before
funding because the server owner must edit shared `app-wallet-session.ts`.
The fresh protected check immediately before that hold found no
`harden-identity-s1` case, no original operation, no rolling-day financial
operations, and the same five protected unknown reservations. No financial
runner was launched between that check and the coordinator's hold. The case
remains unfunded and unsubmitted; the funded slot is free and returned to the
coordinator. Do not start it until the shared adapter and its relevant checks
settle and the coordinator explicitly hands the slot back. This serialization
hold does not cancel the original case or create a replacement run ID.

### Passive feedback measurement fixture during the hold

`treasure-feedback-observation.ts` passively arms a click listener and a DOM
observer on the normal Claim control. It never dispatches input or invokes a
financial command. It measures from the received event to the next animation
frame with disabled/aria-busy feedback still present, and records whether that
input was trusted. Its two-second observation limit only removes instrumentation;
it cannot cancel or repeat an input already delivered.

The wallet-free desktop/mobile duplicate-event fixture uses this same observer.
Its first recorded samples are 3.6 ms and 14.7 ms, with untrusted programmatic
events explicitly identified. These two deterministic samples are neither a
funded interaction measurement nor a p95 qualification. Provider duration and
exact financial outcomes remain separate.

The protected runner has a new, still-unperformed `feedback-claim` fixture for
the previously missing live feedback case. It arms the observer after the
durable claim reservation/submitting marker, then delivers the ordinary trusted
Playwright click and verifies the exact original network payout. Measurement
failure does not skip original financial verification or trigger another spend.
A failed per-sample 100 ms budget is recorded separately from a verified payment
and returns a failed acceptance result; a successful single sample still records
`p95Qualified: false`. Ordinary existing claim cases keep their prior behavior.
The current exclusive-slot authorization covers only `harden-identity-s1`, so
this new fixture must not be run financially without a separate coordinator
assignment after the shared-adapter hold is lifted. Eleven policy tests pass;
no funded latency result, task completion or production qualification is claimed.

The extended wallet-free safeguard test also passes. After the normal claim
handler completes, arming an observation without input expires with no action
dispatched, no extra claim, no disabled control and no instrumentation marker
left behind. Its new desktop/mobile samples are 10.2 ms and 9.0 ms; the source
still labels both programmatic and nonfinancial. Evidence is
`feedback-measurement-safeguards-2026-10-25.txt` under the existing report folder.
The funded slot remains free during the coordinator's shared-adapter hold.

### Shared-adapter checks completed, financial hold not yet lifted

The server owner's implementation turn and subsequent heartbeat are terminal.
The saved implicit-settlement report verifies seven focused tests passed, root
typecheck exited successfully, and the integration package built. This closes
the reported local adapter edit/check activity, not deployed or financial
acceptance. No funded attempt ran here while those changes were in flight.

The coordinator's latest explicit financial hold still controls this owner.
`harden-identity-s1` remains unfunded and the funded slot remains free pending
the coordinator's handoff. The server report's earlier ownership wording does
not itself return that slot or authorize another financial run. Current proof
and game-import gates remain unchanged.

The coordinator's subsequent review found the settlement fixture had not yet
compared adapter selection with the SDK's own selection. It requested that
independent oracle before accepting parity. The seven local passes above are
therefore not accepted as closing the shared-adapter gate; the financial hold
continues. This owner does not alter that adapter or waive the comparison.

The feedback observer's trusted-input branch also passes in the wallet-free
desktop/mobile fixture. Native Playwright clicks produce `trusted: true`, with
observed samples of 12.4 ms and 9.6 ms while inspection remains blocked. The
fixture verifies acknowledgement precedes the action, then releases inspection
and observes one action. Programmatic duplicate events remain separately labeled
`trusted: false`. Neither branch is a live payment or a funded p95 result.
Evidence is `feedback-trusted-input-2026-10-25.txt` under the report directory.

## Original identity/race live acceptance

After the coordinator accepted the strengthened SDK comparison and froze shared
runtime edits, the protected preflight again verified no original case or
operation and no rolling-day spend. The single `harden-identity-s1` funded
attempt then passed on Signet browser validation.

| Exact original evidence | Value |
| --- | --- |
| Contract | `f817f601-d1b8-439b-a2a3-0ba478971b50` |
| Funding | `4a86f5c04c5de94706f3d78618490d520d76e0a6f766ddabaece78a07fcbd138:0` |
| Checkpoint | `e4f36e7c5d388cd01bfb76fd828ee3923611d0cd3e4d7a2ac672b332357523e2` |
| Winning Player payout | `a478458b8227f5fd77246a1c98283e0cd1d03f96e36d991708a219f74563f682:0`, exactly 1,000 asset-free sats |

The actual alternate profile was selected; its Claim and Reject were denied.
The original profile was restored and its contract/deadline remained unchanged.
Competing production commands returned Claim pending and Reject unavailable;
the verifier then traced one winning claim through the exact original funding
and checkpoint to the bound Player script. This is local competing-command
acceptance, not a remote invalid-spend admission or independent-device race test.
The protected fixture verifies the participant identity binding. The coordinator
also independently re-fetched the original payout. Funding and Claim test
operations are settled; no reconciliation/replacement attempt was needed.

Evidence is `identity-race-original-2026-10-25.jsonl` in the existing report
directory. A subsequent live read verifies the Game Wallet's remaining 1,000
sats, and the two settled test operations consume 2,000 sats of the rolling
Signet test budget, including zero fees.

The first `harden-feedback-s1` preflight stopped at a real unavailable wallet
result before any case or operation was created. A bounded read-only check,
`harden-feedback-read-s1`, then passed ready in that same Signet context. Only
after that new evidence did the owner resume the same still-unfunded feedback
ID. Its financial attempt remains under observation in
`feedback-claim-ready-2026-10-25.jsonl`; no result is inferred yet. Independent
Mutinynet fixture balances were read only, with no transfer, replacement wallet,
mint, onboarding or competing spend against the protected unknown mint.

## Source-stable handoff after the bounded funded slot

The resumed `harden-feedback-s1` preflight also returned explicit unavailable
readiness before case creation or funding. Its exact later console snapshot
retained that unavailable Wallet Status and the read-unavailable category.
`feedback-claim-ready-2026-10-25.jsonl` is a terminal preflight failure, not a
second funded attempt, payment failure, timing pass or unknown submission.
No further retry follows this disposition without new evidence and assignment.

The coordinator reported generated-document reload notifications during a
concurrent package build. The protected runner was configured with `stableSource`,
which filters Vite `update` and `full-reload` messages for its page. The available
evidence does not independently prove whether a reload occurred or caused this
read failure. No reload-based explanation is used to dismiss the actual result.
No additional package build was requested by this owner.

Final protected inspection verifies the original identity funding and claim
operations are both settled with the recorded exact IDs. The feedback case does
not exist and has no operation. The rolling-day journal contains only those two
new Signet operations, 2,000 sats including zero fees, and the same five old
unknown operations remain reserved. No financial reconciliation, replacement
mint, independent-wallet transfer or onboarding ran during this slot.

The owner returns the funded slot. All live runner processes are terminal.
Runtime, test and fixture source is now frozen for coordinator integration.
`source-stable-boundary-2026-10-25.json` records SHA-256 hashes for the relevant
Admin code, shared adapter and acceptance files; `financial-slot-final-2026-10-25.json`
contains sanitized exact receipt/reservation disposition. Both are under the
existing report directory. Further source changes require a new coordinated
assignment and invalidate affected integrated snapshot evidence.

Remaining live boundaries are not silently waived: Mutinynet identity/race and
funded feedback, asset-preserving funding, actual network replacement,
legacy-format unresolved rollback, and funded p95 remain incomplete. The
existing unknown mint blocks spending from its original Mutinynet Game Wallet;
read-only balances in other registered fixtures do not qualify or replace it.
Remote negative-admission/delayed-finalization proof remains blocked without
new authoritative evidence. T034-T036 and C094 remain incomplete. Final full
regression/build/CSP/dependency and any release/import decision belong to the
coordinator, retaining all original qualification gates.

## Final local verification, C094-T036

The coordinator's final integrated regression passes 1,337 of 1,337 tests, with
zero failures, skips or TODOs. The first run's 1,336 passes and one failure remain
recorded separately. That failure timed out on Integration README navigation
before policy assertions. The coordinator changed only that test's navigation
to DOMContentLoaded, kept the policy assertions unchanged, verified the focused
check, then reran the whole suite. This is not a focused-only replacement for
the required full regression.

The final suite includes all five CSP checks: script/resource restrictions,
explicit connection-origin validation, authored static hashes, copied launcher/
redirect protection, and real-browser inline/eval/foreign-script blocking with
legitimate Admin/Mermaid/alias behavior. The production dependency audit reports
zero known vulnerabilities. Root typecheck and all root build workspaces pass;
Sandbox also builds with its production deployment prefix. Pages staging and
browser verification pass canonical Admin/Marketplace, the legacy Marketplace
alias, immutable artwork, all 21 Sandbox diagrams and seven Slidev redirect trees.
These are local staged checks, not public deployment evidence.

Authoritative coordinator evidence under
`output/reports/bis-server-treasure-release/`:

- `integrated-regression-2026-10-25.log`: preserved first failure.
- `readiness-navigation-recheck-2026-10-25.log`: focused navigation recheck.
- `final-regression-2026-10-25.log`: complete final 1,337-test pass.
- `final-regression-source-comparison.json`: 935 files, no changes across the run.
- `dependency-audit-2026-10-25.json`: zero known production vulnerabilities.
- `pages-candidate-build-2026-10-25.log`, `pages-candidate-staging-2026-10-25.log`
  and `pages-candidate-browser-2026-10-25.log`: typecheck/build/staging/browser gates.

Recorded read-only verification commands are `npm test`, `npm run build`,
`npm audit --omit=dev --json`, the Sandbox production-prefix build, `npm run
stage:pages` and `npm run verify:pages`. Do not substitute another network's
receipts or repeat an already completed financial case to reproduce a local gate.

The financial disposition remains the exact settled Signet identity/race pair,
no feedback case/operation, and five protected historical unknowns. The game
still references `stealth-steel/vendor/bis-integration-0.0.23.tgz`, with its
original inventory hash, while BIS remains 0.0.26. No game import, version bump,
release or publication occurred in this owner phase. The combined verified BIS
snapshot includes separately authorized coordinator/server work; this owner did
not edit the shared server signing/settlement/proof modules or mutate those wallets.

C094-T036 is complete. T034/T035 and the original deployed-game/live/covenant
qualification gates remain incomplete. This task completion records final local
verification and truthful blockers; it does not declare BIS production-qualified.
This acceptance-document update and the task checkbox are documentation/planning
changes after the run. Runtime, test and fixture sources remain frozen.

## Signet explorer readiness diagnosis and normal Admin recheck

Assigned `harden-network-s1` stopped unfunded on explicit unavailable Wallet
Status. Protected disposition confirms no case, intent or funding, the legacy
case remains settled, and all five older unknowns remain protected. Evidence is
`network-signet-original-2026-10-25.jsonl` and
`network-signet-unfunded-disposition-2026-10-25.json` in the owner hardening
directory. The funded-attempt allowance was not consumed. Its failure log is
preserved; no alternate wallet or replacement funding was used.

The next authorized source-only diagnostic expands sanitized request metadata
to network-replacement readiness failures and gives the existing unavailable
error its explicit safe classification. Known endpoint paths, methods, hosts,
HTTP status and fixed network-error flags are recorded; dynamic identifiers,
query strings, credentials, headers, bodies and raw errors are excluded. The
readiness-only scenario blocks all financial/signing POSTs, retaining only the
exact approved local connection-metadata and observational indexer exceptions.
No runtime readiness, funding, deadline or contract rule was weakened.

Read-only `harden-net-read-s1` reproduced unavailable status. The coordinator's
independent aggregation found 40 successful Signet operator reads and 36 failed
`mempool.space` requests, with no recorded CSP connection block. A bounded
wallet-free comparison then verified the existing explorer fails outside BIS:
Node reports `UND_ERR_CONNECT_TIMEOUT` after approximately 10.5 seconds, and
Chromium reaches its 15-second bound, while Arkade returns valid HTTP 200 JSON
in both environments. No HTTP 429 was observed, so rate limiting is not claimed.
The first comparison's browser document navigated during evaluation; that
failed report remains separate. The corrected stable-document comparison is
`public-provider-read-comparison-complete-2026-10-25.json`.

The alternative is the installed SDK 0.4.79's own Signet default,
`https://mempool.signet.arkade.sh/api`. The coordinator independently verified
HTTP 200, browser CORS and the canonical Signet genesis against pinned Bitcoin
Core v28.0 source. A separate public-key-only readonly SDK wallet using that
explicit diagnostic override read the actual registered Game Wallet's 1,000
available sats, zero boarding sats, online/live state and real HTTP 200 UTXOs.
It used in-memory repositories and no signing identity. This is diagnostic
evidence, not a substitute for normal Admin readiness. Its report is
`sdk-default-explorer-comparison-2026-10-25.json`.

The coordinator changed only the production Signet `explorerApiUrl` scalar and
its existing network-selection test to the SDK-default endpoint. Existing CSP
already permits it; no CSP, public explorer link, wallet namespace, journal,
key, signature policy or deadline changed. This addresses a BIS configuration
override pointing to an unreachable external service, rather than demonstrating
an Arkade signing failure or requiring a dependency upgrade for this symptom.
Other historical onboarding and covenant proof blockers remain separate.

After shared-source handback, normal protected Admin read-only run
`harden-net-read-s2` passes with no explicit provider override. Its actual operator
and `mempool.signet.arkade.sh/api/address/:value/utxo` requests return HTTP 200;
the normal Wallet Status is ready. The local connection-metadata 404 remains an
accurate absent-signer response. No guard was bypassed, status forced, financial
intent created or funded case retried. Evidence is
`network-readiness-sdk-default-normal-admin-2026-10-25.jsonl`. Final affected
diagnostic policy/CSP browser checks pass all 18 tests in
`readiness-diagnostic-final-policy-2026-10-25.txt`. Fresh financial authorization
and final source hashes are still required before reopening the original
network case. The earlier full regression does not cover these later source
changes; final integrated verification remains the coordinator's gate.

The coordinator's next serial fixture run preserved two real failures. Early
slot refusal emitted an extra empty network-diagnostic row before a browser
existed, violating the one-result privacy/guard test. The catch now emits that
metadata only when an owned page exists; the strict CLI test passes unchanged.
The synthetic legacy selector fixture also timed out mutating its disabled
element despite earlier passes. Its initial response is now fully controlled
with explicit HTTP 200/content type/current CSP, without fetching or inheriting
Admin response headers or application behavior. Controlled DOM setup uses direct
page evaluation and asserts the exact document, readiness and disabled state;
production guard assertions and the 1,500 ms locator budget are unchanged.
All old-format, script, role, deadline, outpoint, missing-control and unchanged-
journal assertions remain. The test describes controlled DOM coverage rather
than actual Admin rendering.

The early-refusal test and legacy-transition test each pass independently in
`early-refusal-diagnostic-fix-2026-10-25.txt` and
`controlled-legacy-transition-fix-2026-10-25.txt`. The 18 affected diagnostic
policy/CSP browser checks pass in `final-guard-diagnostic-policy-2026-10-25.txt`.
No runtime, financial behavior, provider probe or funded case changed during
these fixes. Normal Admin readiness evidence remains valid for the unchanged
provider source. New exact source hashes are required for the coordinator's
independent final rerun before any financial handoff.

## Real Signet network-replacement acceptance

After the coordinator's explicit sole-slot re-handoff and fresh normal Admin
and both-network SDK readiness, original case `harden-network-s1` passed. Its
earlier failure remains an unfunded preflight, not another funding attempt.
The actual 1,000-sat Signet contract is
`ab4ab9d2-c89b-413c-bf5b-41514a635c92`. The protected browser recreated real
contexts against the already restored registered Mutinynet pair, denied
wrong-scope Claim/Reject/Refund with zero financial POSTs, and compared both
full journals unchanged. It restored the original Signet identities, contract,
deadline `1792952935000` and funding outpoint before one original Claim. This
is an actual preference/remount transition; the public in-place network change
continues to be guarded while an account is selected.

| Exact original chain | Transaction and output |
| --- | --- |
| Contract funding | `c9f423b1845bd73b06a67768336be739c828cdc2478c5787acbec876fd5ed160:0` |
| Linked checkpoint | `2fc139e0ea8e1f470ea4bda80961523bc6ceb38ebfeb9cb4e79c634164132c11:0` |
| Original Player Wallet Claim | `10b1cda3c414dbeca81f1bf1fa67923007be943c085c850311062d51adb73046:0` |

The verified asset-free payout is exactly 1,000 sats at the original Player
script. Both protected operations are settled at 1,000 sats and zero fees each.
There was no Mutinynet financial action, replacement/duplicate funding,
competing payout or reconciliation attempt. The runner exited 0, all 12 reviewed
source files match, the five historical unknowns remain unchanged, and rolling
Signet exposure is 6,000 sats. The sole financial slot is returned.

Actual execution and protected public disposition are
`network-signet-after-explorer-fix-2026-10-25.jsonl` and
`network-signet-final-disposition-2026-10-25.json` under the owner hardening
directory. The coordinator independently fetched the original chain through
the Signet indexer and verified its transaction bytes, linked checkpoint and
exact 1,000-sat payout. Its report is
`output/reports/bis-server-treasure-release/network-receipt-independent.json`.
The verifier checks the original saved receipt against that fresh chain; it
does not submit a transaction. The separate post-run source comparison reports
all 12 reviewed files unchanged. Browser scope-switch and journal assertions
remain supported by the owner run, rather than by the chain check alone.
This completes this real Signet/browser case only. Other network/
mode coverage, asset-preserving funding, funded responsiveness, upstream
covenant qualification, final integrated checks and game integration retain
their existing gates.

Before funding, the owner caught a stale coordinator test-name filter: its log
included a legacy file-level pass rather than execution of the renamed
regression. The full file was therefore run explicitly, and the actual named
controlled-transition test passed in
`pre-network-actual-legacy-regression-2026-10-25.txt`. The coordinator acknowledged
the coverage distinction. The final integrated suite must execute actual tests
without using a file-level green result as named assertion coverage.

## Subsequent full regression, 2026-10-25

With no BIS regression or live acceptance process found in the host process
inventory, the owner ran the full serialized root test runner with Node 24.21.0
and the existing Playwright browser cache. It finished with 1,382 tests,
1,380 passed, two failed, and zero skipped, cancelled or TODO tests. The actual
named legacy-transition, deterministic network-replacement and early financial
slot-refusal tests executed and passed. Typecheck exited 0. No financial case,
server restart, build, dependency change or game import was performed.

The two failures are the private owner-controls fixture's 30-second page-load
timeout and the Marketplace cold-address performance assertion. The latter
recorded Player at 3,414 ms and Game at 3,327 ms against an unchanged 1,500 ms
limit. DOMContentLoaded took 2,519 ms; fixture diagnostics report no page errors
and zero mutations. These measurements do not establish the cause or justify
raising the limit. Some isolated Vite fixtures also reported an occupied default
HMR port; the existing listener was left intact.

The 874-file source capture detects three changed server files across this run:
`funded-workflow-live.ts`, `protected-browser-journal.ts` and
`protected-browser-journal.test.ts`. This is not an unchanged final snapshot.
Preserved logs, exit dispositions, source hashes and the copied performance
measurement are under
`output/reports/treasure-contract/hardening/final-wallet-free-regression/`.
A single focused diagnostic rerun executed the exact two failing tests with
source and thresholds unchanged. Owner controls passed; the cold Marketplace
test failed again, with Player at 1,668 ms and Game at 1,658 ms. DOMContentLoaded
took 1,122 ms. The report again records no page errors or mutations. Its actual
two-test count is recorded in `focused-failure-diagnosis.log`; the separate
copied measurement is `marketplace-focused-cold-label-timing.json`.
This reproduces the performance failure without establishing its cause. The
owner-controls pass does not erase the earlier navigation timeout. Neither
focused outcome replaces the failed full run or qualifies the changed server
source. A fresh integrated run remains required after source freeze and failure
disposition.

### Isolated production-build address diagnostic

To distinguish development-module startup from the bundled application, an
isolated Marketplace build and preview ran entirely under `output/`, on an
ephemeral port. The unchanged actual cold/reload test passed against that
artifact with the same 1,500 ms limit, public fixture identities, 250 ms
configuration delay, five-second ownership delay and two-second catalog delay.
Cold Player/Game addresses appeared at 543/533 ms; reload at 405/394 ms. The
fixture recorded no page errors or mutations. The preview closed normally.

This build resolves the existing BIS 0.0.26 distribution through its actual
default package export. It does not rebuild or qualify a new integration
release. Exact distribution, input and built-artifact hashes are retained in
`production-label-diagnostic.json`; the copied measurement is
`marketplace-production-cold-label-timing.json`, beside the unchanged-source
full and focused failures. The build emitted a large-chunk warning, retained
in its log. This single diagnostic supports development startup cost as a
contributor; it does not establish a full root cause, waive the dev performance
target, replace the failed integrated run or prove funded responsiveness.
