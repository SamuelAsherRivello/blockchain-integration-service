# Conditional Vault execution evidence

Updated 2026-10-20. The approved version-5 local testnet implementation has passed both-network funded API and browser flows, recovery, lost-response and repository gates. See the [final acceptance report](conditional-vault-acceptance.md) for transaction references, exact verification results and operating boundaries. This feasibility record retains historical failures for recovery provenance. See also [documentation review and setup](conditional-vault-contract-review.md) and OpenSpec change `productionize-conditional-vault-across-supported-networks`.

## Current version-5 evidence

The user approved 1,000 sats and persistent local Docker co-signers on both networks on 2026-10-19. This replaces the historical exact-100-sat constraint described below. Version 5 uses the operator's canonical output order: principal at output 0, extension at output 1, zero-value P2A anchor at output 2. Earlier versions retain their original immutable scripts and protected records.

The registered-wallet production API completed Create, three permissionless increments, public Check between transitions, creator-only Claim, and final recipient receipt inspection on both networks:

| Network | Protected run label | Funding transaction | Creator claim transaction |
| --- | --- | --- | --- |
| Signet | `cv-signet-canonical-a` | `573e1a159bc857ad03622a5da3c84e59ff13e2dc6dd05fcad337db279e94a7a7` | `c83a4b0f0ea8016648dc8b948167663464ea9cc4ff904d926934ffd4d9c30efd` |
| MutinyNet | `cv-mutiny-canonical-e` | `f264a81eda829dfd59945a1801597547db6cdc893fe9bd04208d6809d36aee37` | `4a56dabcdf645e44891197e4369383dba937e9865e4fe7936be7d6ff60643fdc` |

Every state and return output contains exactly 1,000 sats. Co-signer acknowledgement delay is not financial failure: the API races the original response against independently verified network receipts, retains the original signed request privately, and never invents a response or submits a replacement. Indexer `spentBy` identifies the checkpoint; `arkTxId` identifies the actual Ark spend. Inspection verifies both links.

Read-only policy measurements repeated on 2026-10-20 give minimum 1 sat, unlimited maximum `-1`, dust 330 sats, and normalized zero fees independently on both operators. Unsupported fees, changed minimum/dust, network mismatch and signer mismatch block funding before submission. Signet state trees are 219 bytes for states 0–2 and 253 bytes for state 3; covenant branches are 189–190 bytes. MutinyNet has the same tree sizes and 192–193-byte covenant branches. The larger network name changes the committed scope. All are below the pinned VM's 10,000-byte parser limit. Hosted policy is still revalidated before each mutation; these measurements do not promise a permanent operator limit.

Both active co-signers use upstream commit `bd17836542c409d176a3ee61782e00a606d10f6c`, SDK 0.4.79 and scure/base 2.4.0. Signet is at `http://127.0.0.1:7074`, MutinyNet at `http://127.0.0.1:7075`; independent x-only signer pins are in `conditional-vault-capability.ts`. Keys stay in the DPAPI store and container environment, never reports. The image's version field is empty; the source commit and image identity are the reproducibility records, not that field. The older hosted MutinyNet service is not the new default and its original key is retained in historical descriptors.

The emitted-bytecode tests now include asset packets, input/output substitutions, exact time boundaries and process restart. Bitcoin consensus-script tests execute the creator's CSV emergency exit in all states, with correct/incorrect sequence flags. A 330-sat return leaves at most 670 sats for the final 1,000-sat fixture spend. A real unilateral exit also needs the VTXO ancestry/unroll package, mature outputs and separately funded anchor/Bitcoin fees. No cost-free L1 recovery or live Bitcoin exit is claimed.

Clean Chrome contexts have checked the completed contracts on both networks using exported public descriptors, with no mnemonic and no financial requests. Four vault direct-route script paths were repaired and verified in Chrome. Public descriptor import is not global address-based contract discovery.

## Historical evidence, before the approved amount/layout correction

The following sections retain earlier measurements and failures for recovery provenance. Their statements about missing authorization, unsupported new funding or absent happy-path acceptance describe that earlier checkpoint, not the current version-5 implementation.

## Verified results

SDK 0.4.79 provides `arkade.Arkade.connect`, `ArkadeProgramScript`, `contract`, `register`, `functions.<name>().from().to().send()`, `buildOffchainTx`, `signAndSubmitOffchainTx`, and indexer reads. Covenant spending requires the emulator and authenticated previous-transaction data. Emulator keys must be pinned independently of its info response.

The upstream emulator at commit `bd17836542c409d176a3ee61782e00a606d10f6c` compiled on Windows and in Docker. The local Signet instance is bound to `127.0.0.1:7074`, connects to `https://signet.arkade.sh`, and keeps its stable signer in the existing DPAPI-protected test-wallet vault. It has not passed funded contract execution. Its current image reports an empty version string, so source commit and image identity must also be checked before acceptance.

The MutinyNet endpoint `https://emulator.mutinynet.arkade.sh` reports `v0.0.9-rc.2`. Its key matches SDK 0.4.79's independent network pin. Readability does not prove identical opcode support or successful spending.

Both operators report minimum VTXO 1 sat, maximum `-1` meaning unlimited, Bitcoin dust 330 sats, and normalized zero transaction/intent fees. Empty strings and `0.0` normalize to zero. Signet reports unilateral exit delay 172544 seconds; MutinyNet reports 2048 seconds. The minimum VTXO field alone does not establish a spendable 100-sat Taproot output.

The deterministic four-state builder produces 219-byte trees for states 0 through 2 and a 253-byte tree for state 3 with the inspected parameters. Covenant branches were 187 through 191 bytes. These fit the pinned VM's 10,000-byte script parser limit. This does not establish every hosted operator or emulator compute limit.

Executable tests run emitted bytecode in the unchanged pinned upstream VM, with a separate test-only injected clock for deadline boundaries. They cover 180 transition vectors, 64 exact-time vectors repeated after process restart, and real creator signature checks. They reject wrong principal/input amount, extra inputs/outputs, substituted destination/witness version, skipped/rewound state and expired advancement. Recovery is available in every compiled state; its Bitcoin emergency exit remains a separate CSV branch. Funded recovery and full L1 exit economics are unverified.

## Live funding conflict

The first MutinyNet compatibility attempt used the SDK's ordinary `Wallet.send`. Its actual funding transaction is `e615d925663ddf1592c798511eb6c6347c78be8dde5f2d49a104dd809bd5a396`, output 0, 100 sats. Wire inspection proves an `OP_RETURN <output-key>` sub-dust carrier, not `OP_1 <output-key>` Taproot. The indexer normalizes the same output to its Taproot-shaped lookup key. The original receipt has been reconciled; this is funding evidence only. The 100 sats have not been claimed or recovered. Its descriptor and signed submission recovery remain encrypted in the original run record `vault-mutiny-proof-a`.

A second funded-account attempt used the SDK's lower-level exact-output builder to request a genuine 100-sat Taproot output. The real MutinyNet operator received the submission and rejected it as below the 330-sat dust requirement. The attempt is `vault-mutiny-proof-c`. Its original signed request and rejection remain in protected recovery; it must not be retried as a new operation. No contract execution or return payment was verified.

The pinned emulator also reconciles the wire previous-output script exactly against its witness UTXO and requires Taproot script commitments. Replacing an OP_RETURN carrier with a Taproot-shaped lookup key is not a verified solution. Do not claim the first attempt satisfies the covenant.

Capability preflight and the existing Create demo now reject funding below the advertised Taproot dust floor. The production UI/API replacement is incomplete. No amount change, collateral substitute, or operator migration has been authorized. Completion requires a decision resolving the exact-100-sat requirement, followed by real acceptance on both networks.

Signet funding has not succeeded. The previously registered account has an unresolved historical faucet request. A request on another approved account, `cv-signet-fund-b`, also remains unknown, and the faucet's read-only request-status lookup reports unavailable. Both reservations are retained. Do not submit duplicate requests to work around absent acknowledgements.

## Reproduction

Run `pwsh -NoProfile -File BIS/tools/conditional-vault-vm/build.ps1` to build the test runners from the exact upstream revision. Run the `conditional-vault-program.test.ts`, `conditional-vault-core.test.ts`, `conditional-vault-capability.test.ts`, and `contract-setup.test.ts` files with `node --test` under `BIS/packages/integration/tests/client/`.

Run `node BIS/scripts/contract-setup.ts test-account-1` for read-only setup, and `node BIS/scripts/contract-capability.ts test-account-1` for independent network capability classification. The latter now reports the funding conflict before spending.

The local service was built from the pinned upstream Dockerfile with image tag `bis-conditional-vault-emulator:bd17836542c4`. Its build produced manifest digest `sha256:8a99b4bc39176d613c65f7fa440dfb7c696c5f0bfbab1555b84b51de090fff41`. Run `node BIS/scripts/conditional-vault-service.ts start` to reuse its protected stable key. Docker requires host access. Never inspect or print the container's secret environment. Local HTTP is not a production HTTPS deployment; browser transport, rotation and restart acceptance remain pending.

`conditional-vault-compatibility.ts` is a protected compatibility runner, not the completed production acceptance suite. It refuses an already recorded run and journals original requests before provider submission. `conditional-vault-reconcile-compatibility.ts <run>` performs reads only. Neither command's successful funding observation establishes a completed covenant lifecycle.

## Blocker prevention and resolution matrix

| Blocker | Named prevention check | Resolution or recovery | Fail-closed outcome |
| --- | --- | --- | --- |
| Operator capability | `contract-capability.ts` plus exact-output funded proof | Compatible, approved operator policy | No new funding |
| SDK expression | Deterministic builder and pinned VM tests | Supported low-level APIs; reviewed upgrade if required | No invented compiler success |
| Counter enforcement | Emitted-bytecode transition vectors | Next-state script commitment; creator-signed terminal branch | Invalid transitions reject |
| Amount/script/policy limits | Dust guard, tree measurement, zero-fee policy | Resolve 100-sat/dust conflict by explicit decision; never silently raise amount | Currently blocks funding |
| Network differences | Independent pins and network identity tests | Separate operator/service configuration and live runs | One network cannot satisfy the other |
| Wallet identity | Verified inventory, isolated repositories, immutable descriptor keys | Restore exact original identity/session | No cross-identity signing |
| Inputs and funding | Grant, balance, ledger and faucet receipt checks | Reconcile original funding; replenish approved fixtures only | Preserve reservations |
| Lost acknowledgement | Encrypted pre-submit recovery plus operation ledger | Original transaction/output reconciliation | Never create a replacement spend |
| Expiry or downtime | Fixed-deadline VM vectors and explicit recovery branch | Creator-authorized recovery; independently verify L1 exit funding | No browser deadline extension |
| False acceptance | Separate setup, VM, compatibility and production evidence | Complete both real network matrices after policy resolution | Change stays incomplete |

The matrix names prevention and recovery work. It does not mark the unresolved production recovery, operator policy, browser, or funded acceptance tasks complete.
