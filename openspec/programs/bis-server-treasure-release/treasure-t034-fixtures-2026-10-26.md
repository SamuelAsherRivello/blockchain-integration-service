# C094-T034 fixture completion, 2026-10-26

Scope is the deterministic acceptance-fixture task only. The coordinator
assigned this owner T034 after CLI progress reached 22/36. T035, qualification,
protected wallets, providers, financial operations and game import were excluded.
Existing live fixtures were reviewed before editing. Only the Admin acceptance
entry point and three new diagnostic/test files changed; shared wallet/runtime,
server-owner files and the B2 source pin were preserved.

## What changed

The Admin acceptance harness now projects errors through a dedicated public
diagnostic module. Arbitrary lowercase codes, custom error names, extracted
JavaScript identifiers/property names and extra browser-failure fields no longer
become output. Known readiness, budget, original-recovery and protected-vault
reasons remain available. Page errors are capped at the same 20 observations as
console errors. Both initial and portable-recovery browser callbacks use the
projection. No signing, balance, contract or receipt behavior changed.

Five new diagnostic tests cover code-shaped canaries, raw messages, attached
signed-data fields, known failure reasons, UI identifiers, unknown browser
stages/flags and unrelated private getters. All use explicit synthetic values.
One new actual-SDK transaction test verifies that Claim consumes only the funded
contract/checkpoint, pays exactly 1,000 sats to the bound Player and requires no
additional Player input. It creates no wallet and refuses network requests.

## Scenario coverage

| T034 case | Existing executable fixture | Safeguards verified in this pass |
| --- | --- | --- |
| Session end | `session-rollback`, `endOriginalTreasureSession` | Production LTO service tests cover end during funding, original cleanup, creation-disabled recovery and unknown private authority preventing competing refund. The browser helper checks exact identities, contract and deadline before duplicate original-session end calls. |
| Duplicate/competing requests | `duplicate-claim`, `empty-duplicate-claim`, identity race | LTO service tests verify one funding call, cooperative-controller exclusivity and unknown claim reservations. Browser feedback delivers duplicate input and observes one handler while inspection is held. |
| Identity/network changes | `identity-race`, `network-replacement` | Registered saved alternate identity policy passes; account replacement refuses adapter submission. The actual encrypted storage/service browser fixture passes both network directions with identical profile IDs, denied wrong-scope actions and unchanged original/other journals. |
| Asset-preserving funding | `asset-claim` and independent asset verifier | Actual SDK asset extension and checkpoint wire tests preserve a quantity above JavaScript's safe integer range, exact game change and asset-free reward. Altered asset quantities, unrelated inputs, missing wire, changed amount and asset-bearing reward are rejected. |
| Empty-player claim | `empty-duplicate-claim` | Runner source checks all three actual Player sat balances are zero before case creation/funding. The new independent SDK test establishes the claim's exact input ancestry and full output without any Player funding input. This is construction evidence, not a live zero-balance observation. |
| Insufficient funds | `insufficient` | Adapter tests refuse depleted inputs before submission. Policy tests require exact `failed`/`not-submitted`/`insufficient-funds` evidence and zero attempted submissions; a blocked financial POST cannot become proof of a successful application refusal. |
| Lost acknowledgement | `lost-claim-ack`, `recover`, `peer` | Policy tests preserve original mode/network and never retry on observation timeout. Actual SDK adapter tests recover only the journaled finalization. Runner source forwards one original request, drops only an actual successful response, fingerprints finalization bytes and rejects a second claim submission. Prior separate journal/transport verification remains 12/12 and is not added to this pass's count. |
| Rollback | `session-rollback`, `legacy-rollback` | The pinned 0.0.23 archive verifies its own 149-file inventory, safe extraction and dependency pins. Genuine old public factories load wallet-free. Corrupt archive, wrong provenance/origin, changed legacy bindings and duplicate original actions are rejected. Current creation-disabled LTO recovery tests pass. |
| Funded-action responsiveness | `feedback-claim`, passive observation | Desktop/mobile browser fixtures verify immediate busy feedback, duplicate suppression, stable button bounds, no-input observer cleanup and trusted/untrusted input classification. The runner keeps `sampleCount:1` and `p95Qualified:false`. These synthetic checks do not measure a funded p95. |

The 5,000-sat operation cap, 10,000-sat rolling-network cap, protected slot,
pre-funding eligibility and exact-original recovery policies are unchanged.
Live cases still require fresh checks and coordinator ownership. An unknown
operation preserves its reservation; observation timeout does not cancel it or
authorize another transaction. Existing inconclusive upstream probes stay closed.

## Verification

- 68/68 pass in the seven-file deterministic safeguard run: diagnostics, policy,
  asset evidence, receipt ancestry, LTO service, adapter and private-pending tests.
- 12/12 pass in network replacement, legacy transition, protected legacy harness
  and Admin feedback suites. The installed repository Playwright cache was used.
  Vite instances were isolated test servers; shared servers/storage were untouched.
- 1/1 pass in the new empty-player SDK construction test. Final total is 81
  unique passing tests with zero failures, skips or TODOs.
- Targeted strict TypeScript checking passes for both new tests and the diagnostic
  module with project-aligned Bundler/Vite settings. Root `npm run typecheck`
  passes with no diagnostics. An intermediate new-test diagnostic about an
  optional SDK output amount was corrected with an explicit runtime assertion;
  the failing log and initial passing runtime attempt remain preserved.
- In-memory bundling of the Admin acceptance entry point succeeds without
  executing it. The initial 32 reviewed inputs remain byte-identical across the
  80-test run. The later empty-player test and its public fixture are separately
  recorded in the final source manifest.

The complete commands, input hashes, final logs and scope are under
`output/reports/treasure-contract/t034-fixtures/`. No credential read, live
provider request, wallet action, funding, remote signature, onboarding, release
or game dependency import occurred in this task.

## Remaining blockers

T034 can complete because its fixtures and safeguards are verified. T035 remains
unchecked. No missing live case, funded timing sample or production enforcement
guarantee is completed here. The coordinator's B2 attempt stopped at protected-
vault authorization before provider access; restore that same protected path
before any separately assigned reconciliation or operation. Do not initialize
another vault or reinterpret an unknown result as failed. B1 still requires
attributable operator evidence and must not be retried blindly.

The B2 source pin remains
`f702ab5e51b7e2836d95dbb9f01a0d402ec087974a707ad77d34d6c72f813bae`.
Game import and all other unchecked tasks remain separate.
