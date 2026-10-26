# Signet onboarding comparison, 2026-10-21

## Result

Later the same day, the standing test-wallet grant enabled a real funding
bypass. Signed operator queries reconciled the source wallet's current inputs;
5,000 existing Signet Arkade sats funded the faucet and its normal API paid
3,000 sats to the BIS test Game Wallet. Real Admin contract funding, claim,
uninterrupted expiry/refund and original interrupted recovery then passed.
This does not repair boarding or qualify Signet covenant enforcement. See the
live acceptance update below for receipts and limits.

The observed onboarding failure is reproducible without BIS's wallet service.
The official SDK's `Ramps.onboard` fails on the same Signet faucet funds with
both stable 0.4.79 and prerelease 0.5.0-rc.25. A fresh attempt through the running
BIS faucet also fails. The tested SDK upgrade does not resolve this incident.
This identifies a failure returned by the configured operator's batch service,
not proof of a network-wide Signet outage or reports from other users.

| Implementation | Inputs | Observed result |
| --- | --- | --- |
| SDK-only `Ramps.onboard`, 0.4.79 | 13 confirmed inputs, 1,030,000 sats | Registration and acknowledgement HTTP 200; terminal `batch_failed` |
| SDK-only `Ramps.onboard`, 0.5.0-rc.25 | Identical inputs and identity | Registration and acknowledgement HTTP 200; terminal `batch_failed` |
| Running BIS faucet, SDK 0.4.79 | Identical inputs and identity | Fresh onboarding returns HTTP 503; stored operation becomes `failed` |

Both SDK batch-failure reasons contain `failed to estimate fee rate`,
`fee-estimation-unavailable` and `HTTP 400`. The latter is in the backend failure
reason, not an HTTP 400 from registration. The SDK's subsequent cleanup
`deleteIntent` request separately returned HTTP 400. Neither is a successful
onboarding or payout. The faucet still has 1,030,000 boarding sats and zero
spendable Arkade sats.

The stable batch ID is `20909ab9-0ca3-4eb3-8ad0-b07c19fc7af1`; the prerelease
batch ID is `e8ae4bce-8a78-4d6f-bfbb-63157c155522`. Both original encrypted intent
journals record `batch_in_progress` followed by `batch_failed`, without a
commitment transaction ID. The fresh BIS operation's update timestamp advanced
from `1792582887762` to `1792588027596`; this was not a cached error response.

All three input inventories have SHA-256
`268bb0d2cc618aa4df0da14bef27f30762f3c860b39e4a03241772acc5a3f1b6`, over
JSON records `{txid,vout,value}`, with string values and sorted outpoints. The
operator publishes empty intent-fee expressions and direct fee rate `0`.
For these inputs, official Ramps and BIS's full-value settlement therefore
request the same principal. This does not qualify other fee policies.

## Reproduction and protection

[`sdk-reproduce.ts`](../tools/signet-onboarding/sdk-reproduce.ts) imports only
Node and the selected official SDK. It does not import BIS onboarding,
contract or wallet adapters. It calls the official `Wallet.create` and
`Ramps.onboard`, with automatic settlement disabled and no simulated provider
responses. The separate [credential/journal harness](../scripts/signet-sdk-probe.ts)
loads only the approved faucet mnemonic at runtime and supplies it privately.
SDK intents and signed request bodies enter the existing encrypted private
vault before network submission. Only public IDs and classified flags are
printed. No phrase, signed request or raw exception belongs in this report.

The stable probe initially reported uncertainty conservatively. Inspection of
its durable SDK `batch_failed` transition established the terminal outcome.
The prerelease changed the intent query API, which affected post-processing in
the first diagnostic harness, not SDK settlement. Its already-recorded terminal
batch event established the same outcome without another submission. The
harness now tracks saved intent transitions without depending on that query
API. Original results remain retained privately rather than overwritten.

The installed stable SDK's 116 published files were byte-compared with a fresh
isolated npm installation: no changed or extra files. Its sorted file/hash
inventory SHA-256 is
`cac23d9224feda4fa95745cb01539bdac221fdad7a472b0ebf212c0036e54852`.
The prerelease was installed only under `output/tools/signet-sdk-rc`, with
package lifecycle scripts disabled. No BIS or game dependency pin changed.

Further live reproduction requires a fresh run ID, private journal access and
the user's existing test authorization. An unresolved prior probe blocks a
new attempt; the harness never treats a timeout as verified failure.

## Dependency findings

The npm registry was checked on 2026-10-21. `@arkade-os/sdk` 0.4.79 is the latest
stable tag; `rc` points to 0.5.0-rc.25. The
[stable release notes](https://github.com/arkade-os/ts-sdk/releases/tag/@arkade-os%2Fsdk%2F0.4.79)
are separate from prerelease status. Registry checks, not cached documentation
version labels, establish the current tags.

| Direct dependency | Installed | Latest stable reported by npm |
| --- | --- | --- |
| Arkade SDK | 0.4.79 | 0.4.79 |
| React and React DOM | 19.3.0 | 19.3.1 |
| Vite | 8.3.4 | 8.3.5 |
| Playwright | 1.64.0 | 1.64.1 |
| Mermaid | 12.1.0 | 12.2.0 |

These unrelated updates were not applied as an attempted fee-estimation fix.
No result here supports upgrading them to resolve the operator's failure.

## BIS defect fixed

The faucet previously presented every `operator-unavailable` failure as fee
estimation unavailable, even for a timeout, fetch failure or network mismatch.
The public projection now uses the fee-specific label only when the underlying
error identifies fee estimation. Other operator failures receive a generic
operator message. Unknown outcomes stay pending and raw unclassified exception
text is not exposed. This reporting defect did not cause the reproduced
network failure.

Verification: 20 focused tests passed; the complete faucet suite passed 19
tests with its explicitly gated live test skipped. Typecheck and the
TypeScript-migration check and faucet build passed. This investigation issued
no server start, stop or restart command. The final listener inventory is
5174 PID 14388, 5190 PID 94196 and 5192 PID 99548; it differs from the earlier
thread's inventory. No attempt was made to restore those older processes.
That API's recorded start preceded the reporting-source correction. The later
authorized restart below loaded it. No wallet storage was reset or migrated,
original recovery material remains private and the game dependency remains unchanged.

The next technical action is operator-side investigation of the failed batches
and the wallet/fee-estimator response. No client-side fabricated fee, simulated
settlement or replacement service was used to bypass the failure.

## Faucet-only restart and workaround investigation

On 2026-10-21 the user authorized restarting only the faucet API. Ownership was
verified against its parent, the shared frontend's live instance identity and
the TCP listener. Both the root startup lock and `sidecar-5190/startup.lock`
were held through the replacement and verification. Only PID 94196 stopped;
the replacement is PID 75740 on 5190. Health reports both supported networks.
Frontend PID 14388 on 5174 and release-clone PID 99548 on 5192 retained their
identities and start times. SHA-256 checks confirmed the shared run record and
Signet onboarding journal stayed byte-identical. No wallet reset, migration,
game import or dependency upgrade occurred. The live balance remains
1,030,000 boarding sats, zero available, with the original failed operation
timestamp `1792588027596` and the corrected public fee-specific message.

The subsequent inspection used public network reads and a temporary SDK
`ReadonlyWallet`. The diagnostic rejected non-GET/HEAD fetches. Two SDK
requests were blocked; it signed and submitted no transaction. At
`2026-10-21T14:07:49.291Z`, all 13 confirmed boarding inputs were unexpired.
The decoded actual boarding script has a 15,552,000-second CSV exit delay.
The earliest nominal maturity calculated from the confirming block timestamp
is `2027-04-08T07:38:43Z`. Actual spend eligibility depends on Bitcoin's CSV
and median-time-past rules, not that wall-clock estimate alone.

| Candidate | Finding | Qualification |
| --- | --- | --- |
| Change client fee lookup or set a client fee | The operator calls its own estimator while building the commitment, before adjusting its funding inputs. A client fee does not replace that call. | Not a demonstrated workaround |
| Use default settlement or fewer boarding inputs | Default selection excludes expired inputs, but all 13 are unexpired. The builder still needs its estimator with a smaller batch or excess input value. | No new identical or smaller financial attempt was submitted |
| Sweep expired boarding funds | The SDK supports an onchain CSV sweep without the operator. None of these inputs has matured. Reboarding swept funds would still require an operational batch service. | Not available now and not an onboarding fix |
| Receive existing Signet Arkade funds | Offchain receipt avoids a new boarding commitment. BIS checks available funds before the failed boarding record, so later faucet sends can use that balance without clearing the old failure. | Real protocol path; not live-funded in this investigation |
| Use a swap or alternate operator | Current official developer preview lists Lightning on mainnet and onchain swaps on Mutinynet, not a verified Signet route. The old Boltz package is deprecated. Another operator would change the trust/address context and would not move these boarding funds automatically. | No qualified Signet replacement was found or configured |

The source explanation uses the inspected upstream revision
`f863e484719344edbe4a8d10cf5fe994b123f2c0`, not a claim about the unknown deployed
operator version. In that source, commitment construction calls
[`EstimateFees`](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/internal/infrastructure/tx-builder/covenantless/builder.go#L989)
unconditionally. The wallet calls NBXplorer; its local error fallback applies
only to `regtest`. The NBXplorer request already supplies `fallbackFeeRate`,
so adding a similarly named browser option is not a fix. Operator-side
inspection must determine why that request fails and verify a real batch
after repairing or configuring the estimator.

The [official SDK documentation](https://arkade-os.github.io/ts-sdk/) distinguishes
offchain receipt from boarding. The
[developer preview](https://docs.arkadeos.com/intents/developer-preview) documents
the available swap networks. The
[Boltz package README](https://github.com/arkade-os/ts-sdk/tree/master/packages/boltz-swap)
explicitly warns against new integrations with that deprecated package.

Read-only live checks of all nine registered test identities found one possible
funding source: `test-account-1` has 10,885 available Signet Arkade sats. It also
has an existing user-reported pending onboarding hold. The other eight show
zero available Signet Arkade sats. A balance alone does not resolve that hold
or authorize spending its inputs. No funds were moved and no hold was cleared.

The safest next funded test needs an approved, reconciled source of Signet
Arkade sats. It can send directly to the faucet's existing `arkadeAddress`
returned by `GET /api/faucet/addresses?network=signet`, then verify the indexed
deposit and available balance before a separately identified test payout.
This bypasses onboarding for fresh funds; it does not convert or recover the
1,030,000 boarding sats. Contract creation/claim/refund still need their own
live acceptance. Browser signing is unrelated to the fee-estimator failure.

A new deterministic regression verifies the existing offchain-funded path
never selects boarding inputs, calls settlement or rewrites the failed
boarding journal. All 21 focused shared-wallet and faucet-core tests pass.
The regression uses test doubles and is not live funding or contract proof.

## Live bypass and treasure acceptance update

The earlier no-spend conclusion above describes the state before the user's
subsequent authorization. The user then authorized reconciling the hold and
using the funds, and granted standing permission to fund, onboard and use
registered Signet and Mutinynet test wallets. That grant is recorded in
`AGENTS.md`. It does not authorize mainnet, clearing unknown production
outcomes or importing the game dependency.

For `test-account-1`, there was no matching runner financial reservation.
Signed ownership queries to the operator's pending-transaction and intent
lookup APIs returned zero pending transactions and zero registered intents
for both current boarding inputs and all 11 current offchain inputs. The
original October 11 user-reported hold remains archived in the encrypted
vault, alongside the exact input inventory, signed queries and observations.
Its historical outcome stays `unknown`; the reconciliation establishes no
active reservations on those current inputs, not a fabricated historical
failure. The active hold was removed atomically with that archive.

[`signet-funding-bypass.ts`](../scripts/signet-funding-bypass.ts) selected five
asset-free 1,000-sat outputs. It checked the actual submitted input set and
faucet output before submission and persisted requests before each network
mutation. This is a real wallet-to-wallet funding transfer, not a contract
execution claim. The subsequent normal faucet payout is also a funding
transfer. Only the separately funded contract and its actual spend establish
treasure execution.

| Case | Exact transaction ID | Result |
| --- | --- | --- |
| Test wallet to faucet | `30e70d234e886c5c9d036350966e6fa2a691e6c2d566b0830b1bbbaa5c101a92` | 5,000 sats at output 0 |
| Normal faucet API to test Game Wallet | `e9756ca826159518d2f9a25306a8b2e6cb473438197bb963bff33b4798c291d6` | 3,000 sats at output 0 |
| Admin treasure funding | `377deb629d0adc1b89682e38f2c898c811baa33e94d9f1531c20f6287602be8f` | 1,000 sats at the compiled contract output |
| Admin Claim | `3bc65a1fab9e638755762c5baf92e15e7b632b3bdd71bb603fd495f1e763af1c` | 1,000 sats to the bound Player Wallet |
| Interrupted expiry test, original recovery | `d6e9e37278dea2a83e5b16c3cee5e38952fead9bbfa8e8e109c0d47284d6fd71` | 1,000 sats to the bound Game Wallet |
| Uninterrupted expiry/refund | `040f66b91b24dfd684487f38aab6a1d86c7615407c7bcaa15ce1d5c67c579b26` | 1,000 sats to the bound Game Wallet |
| Interrupted Reject setup, original expiry recovery | `c0644ab83f7fd4c935652ddd588d19c56eb5c7f328f77aabaa0b76e248788de3` | Original 1,000 sats recovered; not counted as Reject acceptance |
| Early Reject through Account contract details | `6c47631db82817f6bc73a74cf12593e65667d301b721ce4579e8af9f8c86d1b5` | 1,000 sats to the bound Game Wallet |

The normal payout used request `signet-bypass-game-a`. The earlier unacknowledged
request `treasure-signet-fund-b` had no recoverable acknowledgement in the
faucet status cache. It was retired under the user's existing prototype-loss
policy with `networkOutcome: unknown`, not called a verified network failure.
The new payout is separately identified and verified.

The faucet's 1,030,000 boarding sats and original failed onboarding timestamp
`1792588027596` remained unchanged through both transfers. No onboarding batch
was retried. The source's remaining 5,885 offchain sats and 124,997 boarding
sats were not moved by the seed transfer. The Player Wallet had no network
holdings when first restored and received the exact 1,000-sat claim.

[`verifyTreasureSpendReceipt`](../scripts/test-wallets/treasure-receipt.ts)
independently binds the spent contract output through its actual SDK checkpoint
transaction to the exact payout. It rejects an unrelated same-value payment,
wrong amounts/scripts, asset-bearing payouts and an unspent source. The Claim
checkpoint is `933703e63d80bf98b5046a3bb03157df50a8225d1ac199edc824ffcb76123ec7`;
the uninterrupted expiry checkpoint is
`72cf08d304d0f83e31311e4201b19d64c5a59f0e96249d653e761d8fbc52d11f`.
Wire transactions and indexed outputs passed these checks separately from UI
status. Private witnesses, phrases and signed recovery remain protected.

The protected Admin runner now handles first-use confirmation and awaits real
asynchronous predicate results instead of treating Promises as readiness. The
restore confirmation lives outside the animated screen so outgoing animation
cannot retain another native modal. A deterministic structural regression
covers this boundary. Test-only hot-update filtering keeps the acceptance
browser on its loaded source without changing the shared server or Arkade
traffic. Bounded vault-lock retries occur only around private state transactions,
never around network submissions. Original recovery verifies the existing
contract instead of funding a replacement. The initial Reject runner navigated
from a closed Account view and stopped before rejecting. Its original contract
was explicitly recovered after expiry. The corrected runner opens Account,
selects a visible row and verifies the exact Contract detail ID before clicking
Reject. `signet-admin-reject-b` then passed early Reject and the full source
chain check. Every funded Signet treasure run in this investigation is resolved.

The full BIS host suite passed 1,160 tests with zero failures, recorded in
`output/reports/treasure-contract/signet-bypass-full-tests-host.txt`. The faucet
suite passed 19 tests with its explicitly gated live test skipped. Typecheck
and the Integration and Admin builds passed. The migration check reports one
possible stale reference in the concurrent server deployment script; no
authored JavaScript files remain in its measured scope. Build warnings concern
existing chunk sizes and a static/dynamic import overlap, not failed builds.

These are real Signet `browser-policy-v1` happy-path and recovery results.
Browser expiry validation remains bypassable by a modified client. There is
still no independently pinned Signet co-signer, and the original boarding
failure remains unresolved. Covenant negative admission, delayed finalization,
portable encrypted recovery and the full C094 matrix remain incomplete. The
game package was not imported, released or modified by these financial tests.

Final read-only checks found 2,000 available sats in the faucet, 2,000 in the
test Game Wallet and the claimed 1,000 in the Player Wallet. All Signet
`signet-admin-*` runner reservations are terminal. The source currently reports
5,455 available and its original 124,997 boarding sats. Separate activity spent
two of its original 1,000-sat inputs outside this run's five-input seed set;
do not mistake the final source balance for a seed-only accounting result.
This investigation did not modify those other operations or their journals.
The exact seed input set and 5,000-sat destination output remain verified.

All eight configured BIS routes return HTTP 200 with their expected titles.
The existing frontend PID 14388, faucet PID 75740 and unrelated 5192 listener
PID 99548 retain their start times. No server was restarted during this funded
acceptance pass. C094 remains 6/26 tasks complete, with its broader qualification
gates still open. Ordinary OpenSpec validation passes with the existing canonical
ID metadata warning.
