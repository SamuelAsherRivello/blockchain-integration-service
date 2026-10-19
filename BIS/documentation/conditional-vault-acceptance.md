# Conditional Vault acceptance

Evidence date: 2026-10-20. The version-5 local testnet demo passed funded API and browser sequences on both supported networks, executable contract checks, recovery and lost-response acceptance, and repository verification. This is application acceptance for the approved local demo, not a mainnet security audit or a public service deployment.

## Implementation and operating boundary

The demo uses version-5 covenant outputs, SDK 0.4.79 and `@scure/base` 2.4.0. Both locally operated co-signers run unchanged upstream emulator commit `bd17836542c409d176a3ee61782e00a606d10f6c`, image manifest `sha256:8a99b4bc39176d613c65f7fa440dfb7c696c5f0bfbab1555b84b51de090fff41`. The reproducible service build retained the existing image and keys on this date.

Signet uses `https://signet.arkade.sh` and local co-signer port 7074. MutinyNet uses `https://mutinynet.arkade.sh` and local co-signer port 7075. Browser CORS requests and stable-key restarts passed independently. These are approved local Vite services, not a public HTTPS deployment. Docker and the protected local service keys must remain available.

Create locks exactly 1,000 sats. Three permissionless spends advance the committed state. Claim requires the creator signature and returns the full principal. Current supported operator fees are zero. A changed nonzero policy blocks new execution rather than taking fees from the principal. Check is a read-only network inspection.

The immutable two-minute deadline governs co-signer acceptance using its UTC clock. A signature accepted before expiry can settle later. Recovery after expiry returns funds through a distinct creator-authorized contract branch. Bitcoin's creator CSV emergency exit is separate, can bypass progress, and requires mature outputs, ancestry/unroll transactions and package fees. No live Bitcoin L1 exit was broadcast or claimed as free.

## Funded API acceptance

Both runs used registered, authorized accounts through the existing protected wallet tooling. Each verified funding, all three increments, public checks between transitions, creator Claim and the creator's actual 1,000-sat receipt. Transaction IDs alone did not count as completion. Inspection verified the checkpoint-to-Ark transaction links, scripts, values and recipient output.

| Step | Signet, `cv-signet-canonical-a` | MutinyNet, `cv-mutiny-canonical-e` |
| --- | --- | --- |
| Create | `573e1a159bc857ad03622a5da3c84e59ff13e2dc6dd05fcad337db279e94a7a7` | `f264a81eda829dfd59945a1801597547db6cdc893fe9bd04208d6809d36aee37` |
| Increment 1 | `a73a8eda0852f5aee8e4eabe3cf58fced6f55f7c7cd974d6c9c906480733f45c` | `69a1f258e3b0f71270027ca4ee4cd4a42045646d026f30424d9d8b25e4475885` |
| Increment 2 | `921f4690cdc9ee8821f26e040ae4d8ae877e94488dbaf57a2237ee878b286d5a` | `ee47b19578070e281909725dfdcd8fee7f35354cabe3c5baeda57c2d15ca28b4` |
| Increment 3 | `ee25eaa5985fd10dfbeca4cacdf29f320dd9265d363baa6967dd24b9b9cd4b75` | `f6ba4b59d15d9e91d1614807a8e04913e0d90c1dce3f301a375a2c9c50988bb5` |
| Claim | `c83a4b0f0ea8016648dc8b948167663464ea9cc4ff904d926934ffd4d9c30efd` | `4a56dabcdf645e44891197e4369383dba937e9865e4fe7936be7d6ff60643fdc` |

## Funded browser acceptance

The actual Create, Increment, Check and Claim pages completed the full funded sequence in isolated Chrome contexts. Their final public Check verified the creator receipt. The selected network drove all providers. The Signet run was `cv-signet-ui-d`; the MutinyNet run was `cv-mutiny-ui-d`.

| Step | Signet | MutinyNet |
| --- | --- | --- |
| Create | `50fea48cb3213dd09d70b63f880b4daf824e8f24dae199942febf312e491f12a` | `a93c7a5caae6675aec5615a9d696f55a977ad59bb5b800ce573bc6a823f87f50` |
| Increment 1 | `679b4e7b11467f7f37e288e8f60066117fa6f80444de60704f80aebf09f5cc28` | `45911d1f48d7a0f0ef795bbdc069799d563304286b9885d75eeb58426ce2d943` |
| Increment 2 | `6c858ab68e14a65ab6da024d064dd338cc18a1b5772418f384897ad834fdf0a5` | `1c2c26f06c7bbe22e010fcdcb50f97ff6852e3bfb1ea52d220762e0f5ce22389` |
| Increment 3 | `5b98d06b23e25c5777d2411650dce50008392977484cdb55ac2605674c482a97` | `533660050be7f162febbd5fe322ddca7562a515708193d49ec8402cc1429842f` |
| Creator Claim | `18f4d903786fb75f6563ceb0fa0b56faf249e2c2e67f3da7b625515e99941634` | `a074535a0e4a41e7206b7fb35243b748c969ede0f1b6d09d7c028e7e4d3a7031` |

The browser may retain the last verified output as an expected-input hint to avoid a duplicate network read. It stores no authoritative counter or claim flag. The API independently reconstructs the graph before every mutation and rejects stale or altered hints before signing. A cached value never authorizes a spend or establishes success.

## Expiry and adversarial execution

`cv-signet-recovery-b` and `cv-mutiny-recovery-a` funded separate fixtures at progress 0, 1, 2 and 3. Both complete records verify fixed deadlines, rejection of late claims, creator recovery from every state, repeated recovery without another spend, and full principal receipts.

| Expired progress | Signet recovery transaction | MutinyNet recovery transaction |
| --- | --- | --- |
| 0 | `f5fa28f7339b4e2c0f4355264988a59cf9d31ede534893a488e22dc186e19507` | `1962d5ae438470ddfc9b89074f3242bb3cba43eac9dcf68a2bd27d0f5d59665f` |
| 1 | `cff1c098facd4883c7df6efc1bfeca51753fd69822b8042be2d27c1f259d10d9` | `cc1c6b6bc0f684b147776d8b7509d1c5235e4ecdb98e20263075cebc104df2af` |
| 2 | `cfb4850dd2dffb8058f1c1f842cfcfdc1fa97645baf10b0dc90709a430c31348` | `7d4fe6e3f0fc4bd0ca7de4b6920c62745177cde02e078f5d5948f4b9ea4cd0bb` |
| 3 | `1f36e1bb8a5dc39203353fe2d86cade31f21e2e85aa2878d8484ab715f639b46` | `ab197f56fa672e0a7851873136e7dfab810e36db8ac957af236c686b8595fbf6` |

Both networks also rejected direct skipped-state, destination theft, reduced principal, extra-output and omitted-emulator submissions. The original funded output remained unchanged after rejection. `cv-signet-extra-a` and `cv-mutiny-extra-a` additionally exercised an already-consumed fully countersigned transaction, a changed committed deadline, direct late increment, and a forged creator signature. The real services rejected them. Creator recovery afterward produced `184a47f5fe3ef3ccd183d1585e3fed63b361a2826265adcb6aea202c35b904cf` on Signet and `b67c6cfef51d41bf8b814eff2ded322782be163e27963939f7a5c87df18f0ce5` on MutinyNet.

## Crash, refresh and uncertain requests

`cv-signet-interrupt-a` and `cv-mutiny-interrupt-a` both completed actual child-process termination after durable preparation, before submit, after operator submit response and after finalization response. Preparation without a submitted request remained rejected, not a fabricated funded success. The other cases resumed their original transaction IDs and refunded every funded fixture after expiry. This caught and fixed an actual BIP-322 recovery-proof signature omission. Regression tests verify all synthetic proof inputs are signed and finalization is durable before dispatch.

Clean Chrome contexts imported the completed public descriptors, performed repeated network Check from separate tabs, and verified terminal creator receipts without a mnemonic or any financial request. Separate unfunded browser fixtures exercised provider outage, descriptor tampering, exact compiled artifacts, keyboard tabs, refresh and real cross-tab journal exclusion on both networks. These synthetic provider failures are UI tests, not funded contract execution evidence.

Early funded browser runs also exposed delayed HTTP acknowledgements and wasted HD discovery before Claim. Their original requests were retained. Signet fixtures `cv-signet-ui-a` and `cv-signet-ui-b` recovered through actual creator refunds `ee41c0c47db883560e66b4dd92d573b910d69b6507f874beced71c869674500b` and `d325eaf120b45351b576034f8270be4fb6b09760defb1aa126db39f3aa8bd047`. MutinyNet `cv-mutiny-ui-a` used the documented service-fence plus authenticated-empty-pending procedure, then refunded `afc3c934588b4f7d7c9fbfcf22458bf2dc407a817fb9ee57b62d04fb93701a6d`. MutinyNet `cv-mutiny-ui-b` reached state 3 but rejected a late Claim and refunded `51a5e80cfba3cdccee3da4655c0c96eb29a00c972ab0520abc4b1a37f2e2e94e`. None of these interrupted runs counts as a successful browser Claim sequence.

Additional mutation tests interrupted real signed increments before submit and after responses on each network. Their fixed deadlines were not extended to accommodate repeated process restarts. Expired fixtures instead used their creator recovery branches. Refunds include Signet `47aadcedc24ac407e5caebbba6860d7345b0e263fb188a2348f11f3600891a3f`, `12fb1932f9a3ba35e0db70cda2240bc3102ee5748a3ddd9f27da2c60ce29ca2a` and `2944789a446e5133d6b3f0b3386d06da815f93ae17dd724fd6c0402eaa2fae3c`; MutinyNet `354f3ae77ae952f7816e2e27ed9b526f5c001ab446967be24d0ce399f27673ef` and `d4f0403564f49430857b848b2bd406d9e5e304739583316042ff12634b076bec`. The crash harness now serializes protected writes and drains them before intentional process exits. One demonstrated stale lock was removed only after verifying its owner process had terminated; no financial record was deleted.

Focused browser tests then withheld the real Claim response. Signet `cv-signet-ui-ack-e` completed Claim `0f6c4de36d8f7bc001ce89f84e4b143711d3086a6262aeb3583296e92ccdb918`. MutinyNet `cv-mutiny-ui-ack-f` completed Claim `62638637d41d5f1dc9cd8dd7e83de0bfecd95b668f52d4e712755148a02f13a2`. Both recovered the exact original result from network receipts and repeated Claim with zero additional financial POSTs. MutinyNet's forwarding request timed out after the browser had already verified Claim and final Check; its original protected record was resumed and independently checked in a clean browser, not replaced with another funded test. The full four-call happy paths remain the separate completed runs above.

Balance reads on the registered API acceptance identities recorded available Arkade balances of 9,885 sats on Signet and 10,000 sats on MutinyNet while other isolated test fixtures were active. These are dated account snapshots, not an assertion that all unrelated historical holdings were spendable or that a concurrent balance delta proves Claim. The exact creator receipts establish the 1,000-sat returns. A separate earlier Signet recovery fixture subsequently refunded `4db59309440931296165a8c06718822096ff0a224384c825335d5c3c1423a03e`. Historical unknown funding reservations remain retained and are not silently cleared.

## Ten-blocker review

| Blocker | Evidence and fail-closed handling |
| --- | --- |
| Operator covenant support | Both funded five-transaction sequences and real forbidden spends passed. Provider outage stays unavailable. |
| SDK expression | The actual builder, pinned emitted-bytecode VM tests and real transactions use supported low-level SDK APIs. No arbitrary-JavaScript compiler is claimed. |
| Enforced progression | Next-script commitments reject skipped, rewound, terminal and substituted spends in emitted-bytecode tests. Real rejected spends bypass UI checks. |
| Script limits, principal and fees | Trees measure 219 or 253 bytes, branches 189–193 bytes. Both operators report minimum 1, unlimited maximum, dust 330 and zero fees. Exactly 1,000 sats is conserved. Changed unsupported terms block funding. |
| Network differences | Independent operator keys, co-signer pins, journals, scripts and funded acceptance records. No fallback across networks. |
| HD identity and signing | Isolated repositories, immutable creator binding, wrong-identity/network tests, real HD-funded browser calls. Claim needs only a creator signer. |
| Suitable funds | Authorized registered accounts supplied real spendable inputs. Unknown historical funding reservations remain intact. No faucet acknowledgement or mocked balance counts as funds. |
| Lost acknowledgement | Durable protected requests, exact replay/finalization, real process crashes, both-network lost Claim responses and repeated Claim with zero new financial POSTs. Controlled service fencing resolves an expired emulator-only request only after authenticated absence proof. |
| Deadline and service outage | Exact clock-boundary VM tests, restarts, four-state live expiry recovery, retained unresolved requests, real local stable-key services. Public HTTPS is not claimed. |
| Evidence quality | Deterministic provider fixtures, actual VM execution, credential-free browser checks and funded API/browser acceptance passed separately. Failure history is retained rather than relabeled as success. |

## Verification and recovery provenance

The [documentation inventory and setup record](conditional-vault-contract-review.md) covers the official Contracts section and linked advanced material. The [adapter guide](../packages/integration/src/client/wallet-layer-arkade/conditional-vault.md) defines rules, service commands, protected replay and legacy recovery boundaries. The [feasibility record](conditional-vault-feasibility.md) preserves earlier failures and measurements without treating them as current acceptance.

Original version-3 and version-4 funded records are retained. Version 3 used a 100-sat OP_RETURN carrier and did not establish a valid spendable covenant. Version 4 committed an incompatible anchor order. These immutable historical outputs are not upgraded by version 5 and no cooperative refund is falsely claimed. Their original artifacts and creator CSV path remain reproducible where present. Bitcoin consensus fixtures test version-4 and version-5 exits; no actual legacy L1 exit package has been broadcast.

## Final repository checks

| Command or check | Result |
| --- | --- |
| `npm run typecheck` | Passed. |
| `npm test` | 1,031 passed, zero failed, skipped or cancelled. |
| `npm run build` | Passed for the root's declared integration, Admin, Marketplace and Faucet targets. |
| `npm run build --workspace @spike/prototype-sandbox` | Passed separately. SDK/Mermaid chunk-size warnings remain; they do not establish contract acceptance. |
| `node --test BIS/packages/prototype-sandbox/tests/browser-smoke.test.ts BIS/packages/prototype-sandbox/tests/browser-conditional-vault.test.ts` | Six passed, including every declared demo route, formatted output, keyboard tabs, pending/unavailable behavior, network switching and cross-tab storage. Chrome was selected with `PLAYWRIGHT_CHANNEL=chrome`. |
| Emitted-bytecode, injected-clock, signature and Bitcoin CSV tests | Passed through the root suite and explicit contract test runs using the pinned upstream VM binaries. |
| `pwsh -NoProfile -File BIS/tools/conditional-vault-vm/build-service.ps1` | Pinned source checked, VM rebuilt, original service image retained. |
| `npm run check:typescript-migration` | Zero in-scope authored JavaScript files and zero stale JavaScript references. |
| `git diff --check` | Passed. |
| `openspec validate productionize-conditional-vault-across-supported-networks --strict` | Passed structurally, independently of the funded results. |

The repository has no root lint script; no nonexistent lint command is reported as passed. An existing browser fixture's repeated timeout was traced to a fixed 50 ms assumption about idle scheduling. The test now waits for its actual scheduled callback, and the full suite passes. The UI review also added keyboard-operable source tabs and safe error handling without changing contract authorization.

Final diff review found no browser counter authorizing funds, wallet-owned substitute vault, fabricated transaction ID, pseudocode presented as executable source, or optimistic financial completion. Local public records contain descriptors, original operation IDs and expected-input hints only. Signed requests stay in encrypted IndexedDB or the protected acceptance store. CLI SDK diagnostics are suppressed in protected acceptance contexts; reports emit only explicit public fields. Temporary one-off diagnostic helpers were removed, not wallet records. No release, commit or push is claimed by this acceptance.

Raw credential-free logs stay under `output/logs/conditional-vault/`. Protected requests, phrases and private keys remain outside reports. The current local Vite origin is `http://127.0.0.1:5174`, with Create at `/prototype-sandbox/demo-14/`. The user-owned Vite server and both stable-key local co-signers remain running. They must remain available for further contract signing.
