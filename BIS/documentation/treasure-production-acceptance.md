# Treasure contract implementation and acceptance

The [frozen BIS acceptance report](treasure-bounded-acceptance.md) is the current
per-mode matrix, stop conditions and blocker disposition. Historical entries
below preserve earlier observations and are not current readiness claims.

## Authorized scope

On 2026-10-21 the user explicitly authorized implementing the upstream BIS work and resolving live blockers for the game's C094, `productionize-treasure-chest-contract`. This document scopes that upstream implementation to the approved [handoff](../../../blockchain-stealth-and-steel-game/docs/treasure-production-handoff.md). The canonical task tracker remains [C094 tasks](../../../blockchain-stealth-and-steel-game/openspec/changes/productionize-treasure-chest-contract/tasks.md). This does not implement or adopt the separate server-wallet proposals.

The approved model has separate user-owned browser wallets, no new application server, a 1,000-sat reward and a deadline of `floor(startedAtMs / 1000) + 90` seconds. On 2026-10-21 the user also approved a disclosed browser-validation mode with real contract transactions. Portable recovery now has the live evidence below; the complete financial qualification and release/import handoff remain incomplete. No public release or mainnet action is authorized by this work.

## Portable recovery acceptance, 2026-10-21

The [recovery procedure](treasure-contract-recovery.md) describes the explicit
Account workflow and its limits. The implementation exports only password-
encrypted recovery, without wallet phrases. Import verifies the selected keys,
original script and scope, preserves existing documents, reserves imported
inputs and disables spending until original-network evidence is checked. Import
does not start a monitor or submit a transaction. Public `IBis` methods are
`exportContractRecoveryAsync` and `importContractRecoveryAsync`; the Admin uses
the same BIS controller through its normal Account controls.

All three cases below funded an actual 1,000-sat contract, exported through the
UI, closed the source browser, restored the wallets in a new protected browser
profile, imported the encrypted file, observed disabled spending, and recovered
the original contract after its unchanged deadline. No financial projections or
provider responses were injected. Different profiles on this host exercise
independent browser storage, not a claim of testing different physical devices.

| Configuration | Original funding transaction | Verified 1,000-sat refund |
| --- | --- | --- |
| Signet Browser validation | `6ceea41aee2e291521cc2b10c369ab9f22a942248797e51386d162fa8ad7e884` | `1ebb57b4f3c280aaf51b1847d8582c8a9b3240c0a7c6b3651dc33a313c458b4d` |
| Mutinynet Arkade co-signer | `178d5871c1248860ee88825b0f06fc156c8f8f0ce58b50f094e3f241dff31b39` | `c1a10250105ce1bbee1afd017508b792d537d21de44ea4f7d61a20c4c43293ea` |
| Mutinynet Browser validation | `1422c8e9e67fed9ad6ae4f434ad32705b6d548f896f69efa50397497c1f75419` | `ec1f1c203406c2ae3a0a76effbe06c1725d5eef66ef861cc1ca05cc98e398bb9` |

Each receipt verifier traced the actual contract/checkpoint/payout chain and
checked its bound Game Wallet destination and absence of assets. Co-signer
recovery first returned unknown after an observation timeout. Reopening the
original imported profile and refreshing confirmed its same saved refund.
This is real interrupted-acknowledgement recovery, not a second refund or proof
of a claim admitted before expiry and finalized after expiry.

The original Signet and co-signer browser profiles also independently recognized
the payout completed by the imported profile through normal Contract Details
refresh. The Mutinynet Browser validation source profile passed the same check.
The adapter now observes that actual chain rather than leaving the old
funded cache active. A competing confirmed payout can also resolve an uncertain
local operation; its superseded private bytes are retained rather than erased.
An unrelated payment or unrecognized source spend cannot establish success.

The final current-worktree host suite passes 1,262 tests with zero failures in
`output/reports/treasure-contract/portable-recovery-final-host.txt`.
The earlier recovery pass passed 1,251 before subsequent hardening and concurrent
unrelated tests were added. Typecheck and Integration/Admin builds pass. The
focused recovery/storage/adapter/lifecycle run passes 45 tests, and the separate
isolated VM proof passes. Build warnings remain the existing large chunks and
boarding-record static/dynamic import overlap. These are not funded acceptance.

New deterministic tests cover encryption authentication, fresh salt/IV,
independent-storage import, wrong network/password/keys, unknown fields, stale
backups, corrupt and oversized files, reset refusal, reserved imports and
competing outpoints. Finalization tests use actual SDK signatures. They verify
the original root, inputs, destinations and signed checkpoints before replay,
including older journals without a retained root PSBT. New direct submissions
retain their exact signed request before the provider call. The isolated pinned
VM proof still passes; it is separate from network admission evidence.

The first `portable-browser-a` harness run had no funding acknowledgement,
contract record or receipt. Its test reservation was retired under the user's
recorded prototype-loss policy with `networkOutcome: unknown`. It is not a
successful lifecycle or verified rejection. The successful new run
`portable-browser-b` explicitly refreshed normal Game Wallet readiness before
creating its funding reservation. That adjustment affects the acceptance
harness, not the game's readiness-skip policy.

The shared server was ownership-verified and reused at 5174, with existing
frontend PID 106300 and faucet PID 86512. No server was restarted or wallet
storage reset. No onboarding action, game import or release ran in this pass.

### Remaining co-signer qualification blocker

A fresh validly signed early-refund probe on the real Mutinynet V2 artifact
again returned generic gRPC code 13 without script/time/signature diagnostics.
Funding was `36f6af7213658a076cdd71f79af95aa03b8f24f420b573f1232875a7bdb29acd`.
The outcome stayed unknown. After the original deadline, recovery sent only the
identical saved refund request. Its response was unavailable, but later exact
receipt inspection confirmed the original 1,000-sat refund
`96af1764dbeef1f62b3580d7b2e66053aec6b52b34b35cf043a3634875a27377`.
The protected reservation is settled and the original journal is retained.

This does not prove that the early attempt was rejected for its time rule.
Wrong-destination and late-claim probes in that run were not performed after
the unknown result. Explicit negative admission and precise remote
admission/delayed-finalization semantics remain unqualified. Operator-side
diagnostics or a supported observable admission/finalization interface are
needed; browser checks and the isolated VM do not substitute for this evidence.
The game import remains separate and must not be called ready on this basis.

## BIS-owned implementation

- `wallet-layer-arkade/treasure-script.ts` compiles the internal V2 program. It commits the original offer, host/run, network, start, wallet keys, destinations, exit delay and deadline. Claim requires player and operator authorization before the deadline. Early rejection and session cancellation require both wallet owners and the operator. Expiry refund requires game and operator authorization. The only unilateral branch is game-owned CSV recovery. Destinations and the 1,000-sat principal are covenant-bound.
- `wallet-layer-arkade/treasure-spend-plan.ts` verifies the actual contract-to-checkpoint-to-virtual-spend chain, participant signatures, exact principal and destination, zero-valued extension and anchors. This is local intent verification, not proof of remote admission or settlement.
- `wallet-layer-arkade/treasure-direct-policy.ts` verifies zero direct transaction fees and supported limits. Intent fees are not assumed to be zero. Its caller must prohibit intent submission. It does not qualify renewal, batch settlement or Bitcoin exits.
- `BIS/scripts/treasure-contract-live.ts` explicitly exercises the BIS artifact under protected standing test-wallet grants. Requests, responses and signed recovery remain in the protected vault. Exact wire transactions and indexed outputs establish results, not balances or toasts. A timeout preserves uncertainty. Negative fixtures require explicit script rejection before their reservation can be released.
- `BIS/scripts/treasure-original-recovery.ts` validates and inspects original saved operations. Its explicit resume mode sends only identical, previously signed PSBTs after original-chain validation. It never creates a replacement contract or signs a new transaction.
- `BIS/scripts/treasure-admin-live.ts` operates normal Admin controls in a protected owned browser profile, using the standing test-wallet grants. It checks actual BIS persistence and independently verifies wire transactions and indexed outputs. Its recovery mode opens the original Account contract details and uses the normal refresh action. It never injects financial projections or network results.

The treasure LTO factory now selects and persists enforcement before funding. `treasure-contract.ts` integrates the compiled artifact with SDK signing, a private signed-request journal, exact reconciliation and identical-request recovery. Existing legacy contracts retain their original script and guarantees. The Admin funding/claim paths now have live evidence for both Mutinynet modes, separately from the isolated compiler proof. This does not qualify every lifecycle case or Signet.

## Admin and game selection

| Network | Admin choices | Default |
| --- | --- | --- |
| Signet | Browser validation | Browser validation |
| Mutinynet | Arkade co-signer; Browser validation | Arkade co-signer |

The labelled Admin selector explains the selected guarantee and locks while an offer is preparing, active or financially pending. Restored offers display their persisted mode. Account contract details also disclose the actual mode. Explicit Admin co-signer selection fails if its pinned service is unavailable; it does not silently downgrade.

The game-facing API exposes no player choice. Automatic selection uses the Mutinynet co-signer when its non-mutating pinned preflight succeeds and otherwise selects Browser validation before funding. Signet has no configured independently pinned co-signer, so it selects Browser validation. The co-signer availability check has a 1.5-second timeout and does not block ordinary startup. Once prepared, a contract never changes mode, deadline, script or principal. An unavailable response after submission remains pending or unknown; it cannot trigger fallback or replacement funding.

Both modes use actual compiled scripts and network funding/spends. Browser validation does not cryptographically enforce the deadline or payout policy against a modified client. The co-signer mode commits those rules to the program executed by the pinned signing service. Neither mode supplies a trusted public reward treasury when both wallet owners control the browser. The public co-signer is testnet infrastructure, not evidence of mainnet production readiness.

## Deterministic verification

### Original recovery binding follow-up

The subsequent C094-T008/T009 pass adds `treasure-recovery-plan.ts` before both
receipt reconciliation and identical-request replay. It checks the saved
operation against the original offer, network/operator, participant keys,
deadline, compiled script, funding outpoint and full 1,000-sat destination.
Both decoded wallet destination scripts must match the committed program
destinations. A saved payout address alone cannot establish the expected
recipient. Invalid material produces a fixed public error before provider
lookup or replay and does not release its reservation or change its mode.

Six new credential-free tests use actual SDK-signed claim, rejection,
session-cancellation and expiry-refund plans. They also cover changed original
terms, payout/input substitution, mismatched saved transaction identifiers,
malformed material, and confirmation of an original claim after expiry without
another provider submission. This does not prove timely remote admission.
The focused recovery/compiler/storage/adapter/lifecycle suite passes 49 tests and
typechecking plus Integration/Admin builds pass. A separate read-only check
accepts three saved requests from earlier live V2 proof runs and skips two
older proof-format runs. It prints only aggregate counts, makes no network
request and changes no protected wallet journal. This is compatibility
evidence against original requests, not a new live admission test.

The complete host suite subsequently passes 1,198 tests with zero failures,
recorded in `output/reports/treasure-contract/recovery-binding-tests-unrestricted.txt`.
The earlier restricted run passed 1,165 and failed 31, including browser and
temporary private-vault file-permission errors. Its separate report is
`recovery-binding-tests-restricted.txt`; it is not counted as a passing run.
The account-profile browser failure also passes individually on the host.
Concurrent unrelated changes are present in this checkout, so the total test
count differs from the preceding Signet acceptance pass.

Portable encrypted export/import, cross-device reconciliation and the complete
negative-admission/delayed-finalization matrix remain open. This follow-up does
not complete T008 or T009, restart a server, change onboarding or import the
game dependency.

Run from the BIS repository root:

```powershell
node --test BIS/packages/integration/tests/client/treasure-script.test.ts BIS/packages/integration/tests/client/treasure-direct-policy.test.ts
npm run typecheck
node --test BIS/tools/treasure-contract/treasure-vm-proof.test.ts
```

Credential-free tests cover every millisecond offset within a Start second, original-term commitment, malformed bindings, signer requirements, the real SDK checkpoint chain, wrong sources/destinations, reduced payouts, route-specific fee policy, mode selection and immutable storage. Co-signer preflight tests cover key mismatch, malformed responses, outages and bounded waiting. The separately invoked VM test executes 192 vectors for both network bindings in each of two fresh pinned VM processes. It requires the existing VM build in `output/tools/conditional-vault/emulator`, or an explicit `TREASURE_VM_ROOT`. These tests do not prove live network acceptance.

## Live evidence on 2026-10-21

The legacy isolated proof's original Mutinynet refund `f38fc10798b3636d3bc85c5a912f24c14e9aec9c7d3b6611e48a886a58a6c576:0` is now verified as a 1,000-sat payout to its bound Game Wallet. Recovery resumed the identical signed request, preserved the original deadline and reconciled exact evidence after a lost response. Its original journal is settled. Its checkpoint input correctly traces to original funding `f900722519383e10386b2b8f3fd1814df0cce376982313781baf86a3c52f4755:0`.

The actual BIS V2 artifact separately passed:

| Scenario | Exact payout | Status |
| --- | --- | --- |
| Mutually authorized rejection | `29aef3758f137e9b906bf44996fa20d18aed234e2fbfb7c83444716569bcd823:0` | Verified 1,000 asset-free sats to the bound Game Wallet |
| Player-authorized claim | `88afb35cc6bdc1037dad60e51befcd1c31d6e8598d22a86122b673c8d5b0c175:0` | Verified 1,000 asset-free sats to the bound Player Wallet |
| Original expiry refund | `9d967ab859e6e636346473b5354a1ff6db2efb3fdf21cb6721b9025c6337a882:0` | Verified 1,000 asset-free sats to the bound Game Wallet; original request resumed after its deadline |

The last refund resolves the previously pending 1,000 sats from funding `220bbf3a94ab16ab8a62b5fca390d781cf9b966e5ce19b1b2b4acfd24ed9834a:0`. Recovery reused the original signed request, not a new signature or competing spend. Its initial early-refund response was generic gRPC code 13. The deployed handler collapses service failures to that code, so it does not prove which rule rejected the early request. Successful later recovery does not substitute for explicit live negative-case qualification.

### Actual BIS Admin acceptance

| Mode and scenario | Funding output | Verified payout |
| --- | --- | --- |
| Mutinynet Browser validation, Claim | `6bcd1f66874b5e1a402dd915d656f20fa9ef55ae82bba6103b55cbbaa68c139c:0` | `fbf4180e40611687d664fb6c87657e2664f5d74f23b88527106b6bf3449d2e5c:0`, 1,000 asset-free sats to the bound Player Wallet |
| Mutinynet Arkade co-signer, Claim and original reconciliation | `c40a435bd1d053f7a8e9643309cd87ecf4b927896e0a5dcbdb0015929d42559a:0` | `493efce42de8ce95d7362419f725a98eccc72370e69a301f2831f9906da4f626:0`, 1,000 asset-free sats to the bound Player Wallet |
| Mutinynet Arkade co-signer, automatic expiry refund | `2cbf8a8217fb5e97a67bee49ed7aa24fec4e799fc4db614f7b9be8b3fe1a476b:0` | `13ae2ecea82cb06df481ef53cabf68aa2c79ad9f15f69e0be325547c03baed31:0`, 1,000 sats to the bound Game Wallet |
| Mutinynet Browser validation, automatic expiry refund | `1776d7365eaf641e4827c806fcd015cfa5ad32c7ff8d2f16df3d6d613652d3bb:0` | `c4e533db12fa90e8e5bea82148104819d92ef4c7bdc03d82f0a6463988e0d5c9:0`, 1,000 asset-free sats to the bound Game Wallet |

The protected journals for `bis-admin-cosigner-expiry-a` and `bis-admin-browser-expiry-b` record funding and refund as settled, with those exact provider transaction IDs. Both are actual Admin automatic-expiry cases, separate from the isolated artifact refund above. The browser-mode runner independently checked the exact wire output and indexed amount, destination and absence of assets.

The earlier `bis-admin-browser-expiry-a` attempt was interrupted when the preview origin changed from port 5175 to 5174. Returning to its original protected profile through an explicitly isolated 5175 server found only the three prior completed contracts, no new contract record and no funding acknowledgement. Under the user's explicit prototype-loss policy, its test-only unacknowledged reservation was cancelled with `networkOutcome: unknown`, not classified as verified network failure. The disposition retains its original identity and cannot release a claim, refund, acknowledged payment or funding associated with a recorded contract. The new expiry test then completed without copying or resetting wallet storage. The shared BIS server on 5174 and all pre-existing listener PIDs stayed unchanged.

The co-signer case exposed a real acknowledgement wait: its exact payout was indexed while the browser was still awaiting the service response. BIS now bounds co-signer submission observation at 30 seconds and reads at 15 seconds. A timeout records uncertainty, not failure or cancellation. Exact reconciliation can confirm the original transaction without waiting for the original response. Original-request retries have a one-minute in-process spacing limit and always reconcile first. Reopening Account contract details and refreshing confirmed the original result without another claim or signature.

The protected runner also waits for Account's close transition before reopening and reads the existing single-line public report without assuming newline preservation. These are harness corrections, not injected contract state or network simulation.

The independently pinned public Mutinynet co-signer is `03f823b9b2febc81f4af967e77aed2f541cbd3397c6d8f5a72e32eb7b471af889a`. No local Conditional Vault endpoint was adopted. The operator now publishes an intent-input fee expression of `inputType == 'vtxo' && now() - birth < 86400.0 ? amount * 0.002 : 0.0`, while its direct transaction fee rate remains `0`. The live runner prohibits intent submissions and does not subtract any fee from the fixed reward. Intent-based recovery and renewal need separate qualification.

## Remaining gates

### Signet funding bypass and browser-policy acceptance

The subsequent [Signet investigation update](signet-onboarding-investigation.md#live-bypass-and-treasure-acceptance-update)
supersedes the earlier funding blocker described below. Exact signed operator
queries found no pending transaction or registered intent on the current
`test-account-1` inputs. Its historical onboarding hold was archived with an
unknown historical outcome, not presented as verified failure. The user's
standing test-wallet authorization is now recorded in `AGENTS.md`.

A real 5,000-sat transfer funded the faucet's Arkade address; its normal API
then paid 3,000 sats to the test Game Wallet without retrying onboarding.
The 1,030,000 boarding sats and failed onboarding journal stayed unchanged.
Normal BIS Admin controls then passed Signet `browser-policy-v1` funding,
Claim, uninterrupted expiry/refund and early Reject. The Player Wallet was
empty when first restored. Claim paid exactly 1,000 sats at
`3bc65a1fab9e638755762c5baf92e15e7b632b3bdd71bb603fd495f1e763af1c:0`.
Uninterrupted expiry refunded 1,000 sats at
`040f66b91b24dfd684487f38aab6a1d86c7615407c7bcaa15ce1d5c67c579b26:0`;
early Reject refunded 1,000 sats at
`6c47631db82817f6bc73a74cf12593e65667d301b721ce4579e8af9f8c86d1b5:0`.
The receipt verifier traces the actual contract output through its checkpoint
to each payout, not merely a balance delta or same-value wallet payment.

Two interrupted harness cases recovered their original funds without
replacement funding. Their scope, receipts and original financial reservations
are retained privately; the public investigation distinguishes them from the
uninterrupted expiry and early Reject passes. No funded Signet treasure test
remains unresolved. A first-use confirmation now lives outside outgoing-screen
animation, and protected readiness polling awaits actual asynchronous results.
No financial state or provider response was injected into the browser.

The full current BIS host suite passed 1,160 tests, with no failures. The
separate faucet suite passed 19 and skipped its explicitly gated live test.
Typecheck, Integration and Admin builds pass. The game dependency is unchanged.
These results do not repair Signet boarding, supply a Signet co-signer, prove
covenant negative admission or complete portable recovery and the C094 matrix.

### Earlier blocker history and remaining qualification

Signet's original request `treasure-signet-fund-a` lacks a recoverable faucet acknowledgement. On 2026-10-21 the user explicitly authorized treating lost prototype test information as failed for further testing. The test ledger records the original request as cancelled by user-authorized abandonment, retaining its fingerprint and `networkOutcome: unknown`. This is not verified blockchain rejection and does not change production treasure recovery rules. The disposition API is confined to unknown, unacknowledged prototype faucet requests or bound Admin prototype funding attempts without a recorded contract or receipt. It cannot retire a contract claim, refund or acknowledged payment.

A fresh authorized request, `treasure-signet-fund-b`, did not establish funding and remains unknown. The user explicitly approved retrying normal Signet faucet onboarding. That retry returned HTTP 503 with operator fee estimation unavailable. A subsequent read-only balance check still reports 1,030,000 test sats in Bitcoin boarding outputs, zero spendable Arkade sats and onboarding status `failed`, failure code `operator-unavailable`, updated at `1792582887762`. Normal faucet funding does not silently retry that failed onboarding. Signet browser-mode funded acceptance remains blocked by onboarding, not by missing user permission. SDK 0.4.79 has no independently pinned default Signet co-signer; an approved endpoint and pin would enable evaluating that stronger mode, but are not prerequisites for the approved real-contract browser mode. No new service is silently deployed.

The subsequent [standalone SDK comparison](signet-onboarding-investigation.md)
reproduced the fee-estimation failure without BIS using official stable 0.4.79
and isolated prerelease 0.5.0-rc.25. Both recorded terminal failed batches on
the same 13 inputs; a fresh normal BIS attempt then failed on those identical
inputs, advancing its operation timestamp to `1792588027596`. The SDK upgrade
did not resolve it. A separate BIS reporting defect that mislabeled every
operator outage as a fee failure was fixed and tested without restarting the
existing API. These results establish this operator response, not a proven
network-wide outage or another user's report.

The later authorized faucet-only restart loaded that reporting fix on 5190,
replacing PID 94196 with 75740 while preserving frontend PID 14388, the other
existing server and the saved onboarding journal. The follow-up investigation
found no client override for the operator's commitment fee estimator. All 13
boarding inputs are unexpired and none can take the unilateral sweep path yet.
Direct receipt of already-spendable Signet Arkade funds is a real funding
bypass, not successful conversion of the 1,030,000 boarding sats. The one
registered wallet with 10,885 available Signet sats still has an unresolved
onboarding hold, so no transfer was made. Details, source links and the next
funded acceptance steps are in the investigation report. Signet funded
contract acceptance and the separate game import remain incomplete.

Explicit signed negative-spend results, exact remote admission timing, delayed finalization, zero-player-balance behavior, legacy migration, encrypted portable recovery, cross-device conflicts, asset-bearing change, rollback and actual imported-game UI acceptance remain separate requirements. One network or one successful payout cannot qualify the whole feature. C094-T006 and dependent rollout remain incomplete until their specified evidence exists.

Full BIS test reports belong under `output/reports/treasure-contract/`. The first full run encountered sandbox fixture-rename and browser permission failures; a host rerun is recorded separately. No passing focused test is substituted for a passing full suite.

The earlier treasure-focused full host suite passed 1,081 tests in `bis-acceptance-hardened-tests-host.txt`. After startup coordination and the narrow Admin prototype-loss disposition, the full current-worktree host run passed 1,099 tests with zero failures in `output/reports/server-coordination/bis-full-tests-host.txt`. The later focused run passed 18 tests, including the reserved-port guard and actual PowerShell-helper startup/reuse. That regression exposed and fixed PowerShell New-Item's directory-creation race by using the atomic Windows call. The sandbox full run remains recorded separately with fixture permission failures; it is not reported as passing. Typecheck and the Integration build also pass; the previous Admin build passed. Pending rejection stays financially pending across expiry, keeping the selector locked. Credential-free managed-browser checks verified Signet's single option, Mutinynet's preferred default and explicit weaker selection, plus readable desktop/mobile layout. These empty-profile UI checks remain separate from the funded owned-browser cases above. The existing server-wallet connect-route error belongs to concurrent work and remains separate from these checks.

The updated C094 artifacts pass ordinary OpenSpec validation. Strict validation reports the existing canonical `id` metadata key as an unsupported-key warning; this work does not remove the project's permanent change ID to suppress that warning.
