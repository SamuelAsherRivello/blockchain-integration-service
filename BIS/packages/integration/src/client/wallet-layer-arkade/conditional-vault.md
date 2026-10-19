# Conditional Vault adapter

Version 5, SDK 0.4.79, upstream emulator commit `bd17836542c409d176a3ee61782e00a606d10f6c`.
The testnet implementation uses the real Signet and MutinyNet operators. It is not a mainnet security audit or immediate Bitcoin L1 settlement.

## Contract rules

| Branch | State | Authorization | Co-signer UTC rule | Result |
| --- | --- | --- | --- | --- |
| Increment | 0, 1, 2 | Operator and covenant co-signer; no creator mnemonic | Before fixed deadline | Exact next-state output |
| Claim | 3 | Creator, operator and covenant co-signer | Before fixed deadline | Creator destination |
| Recover | Every state | Creator, operator and covenant co-signer | At or after fixed deadline | Creator destination |
| Bitcoin exit | Every state | Creator signature and CSV | Relative delay after the relevant Bitcoin output confirms | Emergency Bitcoin spend, not successful Claim |

Cooperative spends have exactly one 1,000-sat input and three outputs. Output 0 pays exactly 1,000 sats to the committed next-state key or creator. Output 1 is the zero-value SDK extension. Output 2 is the zero-value P2A anchor. Asset packets are forbidden. Witness version, input value, output count, destination and value are checked by emitted covenant bytecode. States are compiled backwards, so a next-state destination commits the remaining program, creator, scope, deadline and recovery branches. There is no unrestricted cooperative escape branch.

Create funds the compiled state-0 address, not another ordinary wallet. The display ID is scoped by network, creator key and contract version. An origin's Web Locks and encrypted journal prevent competing submissions known to that origin; they are not a global unique-ID registry. Different creators may use the same suffix. Disconnected devices must import their original descriptor and recovery data rather than assume a globally unused suffix.

Only normalized zero transaction/intent fees are currently supported. Empty strings and decimal zero normalize identically; maximum `-1` means unlimited. Capability checks compare the principal against current minimum, maximum and Taproot dust. A nonzero fee policy blocks new funding. The adapter never reduces the principal or invents separately funded fees. Check is free of transaction fees because it only reads providers, although those providers can impose their own access limits.

## Adapter and public API

The core `ConditionalVaultApi` DTOs contain public parameters, opaque wallet references, expected outpoints, operation IDs, inspections and outcomes. SDK identities belong only to the host's wallet resolver. The Arkade factory leases an isolated wallet; it must not patch a shared application wallet/provider. The sandbox uses fresh repositories to avoid stale HD state when its mnemonic changes.

`create` accepts either an absolute `deadline` or `durationSeconds: 120`. Duration starts after wallet and capability preflight, and the absolute value is then committed and persisted before funding. Retrying never renews it. The co-signer checks time at signing acceptance. An accepted signature can settle later; neither the browser countdown nor Bitcoin CLTV imposes an upper-bound settlement time.

`increment`, `claim` and `recover` bind to both `operationId` and `expectedOutput`. A repeated ID reconciles the original transaction. A fresh explicit Increment may advance the next state. A pending operation reserves its original input and prevents a competing spend. A lost response is not permission to sign a different transaction. Explicit recovery replays only the original protected request or its original finalization checkpoint; Check never calls that path.

## Evidence and portable inspection

`exportVaultDescriptor` and `importVaultDescriptor` carry a canonical hash, network, version, public keys, creator script, amount, deadline, exit delay, four scripts and original funding outpoint. Import recompiles the program and validates the hash. Unknown fields are stripped. Nested descriptor values are immutable. It contains no secret or signed transaction. Check needs the descriptor, not a mnemonic or a public address that supposedly embeds the constructor.

Inspection fetches the original funding transaction, exact VTXO and complete spend graph. Indexer `spentBy` identifies the checkpoint; `arkTxId` identifies its Ark spender. Each link, value and next script is verified. A creator return additionally requires its actual recipient receipt and the committed Claim/Recover leaf. Missing outputs, archived unsigned PSBTs or local transaction IDs never prove a claim. Missing/paginated history, provider failure or batch expiry produces unknown, pending, conflict or unavailable rather than an empty successful result.

Private signed recovery requests are encrypted with AES-GCM in browser IndexedDB and a nonextractable key. Registered acceptance accounts use the existing Windows DPAPI store instead. These mechanisms do not protect against arbitrary malicious JavaScript already executing within the same origin. Do not log protected journal contents. Public output exposes only sanitized reason codes, receipts and public descriptors.

## Services, restart and migration

The local approved co-signers use ports 7074 and 7075, loopback-only Docker publication, dropped capabilities, read-only containers and disabled transaction logging. Stable secrets live in the existing protected store. Docker administrators can access container environment; this is an explicit local service trust boundary. Preserve old keys and original artifacts through service restart or rotation. A newly advertised key is not trusted automatically. HTTPS remote hosting is a separate deployment, not part of this local acceptance.

Build or retain the pinned service image with `pwsh -NoProfile -File BIS/tools/conditional-vault-vm/build-service.ps1`. Start each network with `node BIS/scripts/conditional-vault-service.ts start <network>`. The script refuses a mismatched image, upstream operator, unsafe port binding or changed signer. Restart uses the same protected key. Existing images are never overwritten by the build script.

An expired emulator request with no acknowledgement can remain genuinely unresolved. Never clear it because a timer elapsed or the input still looks unspent. The registered browser-fixture maintenance procedure `conditional-vault-ui-fence-recovery.ts <network> <run>` first stops old in-flight work by restarting the owned, pinned co-signer. It then authenticates a pending-transaction query using the creator's original committed CSV leaf and independently verifies the same expired unspent output. It releases only an emulator-only reservation when that authenticated query is empty. Any pending transaction, changed input, journal change or unavailable proof keeps the reservation. Original signed requests remain protected. This is an operator-controlled recovery procedure, not a permissionless browser workaround or a generic hosted-service cancellation guarantee. `conditional-vault-ui-reconcile.ts` can then invoke the original contract's creator recovery. A live MutinyNet interrupted browser fixture passed this procedure and returned its full principal.

Legacy browser and compatibility-run records are never erased. Version 3's 100-sat OP_RETURN carrier did not establish a valid spendable covenant. Experimental version 4 committed an incompatible anchor index; version 5 cannot repair it retroactively. Its original scripts and CSV exit path remain reproducible using `compileConditionalVault(parameters, {legacyVersion: 4})`. Funding a new ID does not upgrade old funds. Unsupported records require their original recovery path and must remain visibly unsupported; no cooperative refund is promised for an invalid historical program.

The Bitcoin emergency exit requires mature outputs and their ancestry/unroll package. A 1,000-sat principal cannot necessarily pay those package fees alone. Consensus fixtures use a 330-sat output and at most 670 sats for the final spend, with correct and incorrect CSV sequences. They do not claim that an actual L1 exit package was broadcast. Additional anchor/package fees and current relay policy require separate funding and validation.

## Verification

Build the unchanged pinned VM plus test-only clock runner with `pwsh -NoProfile -File BIS/tools/conditional-vault-vm/build.ps1`. Contract tests execute actual covenant bytecode, signature verification and Bitcoin CSV scripts. Provider fixtures separately test missing receipts, stale history, wrong networks and protected journal tampering.

`conditional-vault-acceptance.ts <network> <account> <id> <run>` uses registered protected accounts for the funded happy path. `conditional-vault-recovery-acceptance.ts <network> <account> <run>` performs real adversarial submission and refunds from every state. `conditional-vault-browser-acceptance.ts` imports completed public descriptors in clean Chrome contexts and verifies no financial writes. Fixture tests and source-tab tests do not count as funded acceptance. See the repository's [execution evidence](../../../../../documentation/conditional-vault-feasibility.md) for measured limits and actual run references.

`conditional-vault-interruption-acceptance.ts <network> <account> <run>` kills real child processes after durable preparation, before submit, after submit response and after finalization response, then reconciles their exact original requests. `conditional-vault-adversarial-extra.ts` exercises replayed consumed outputs, changed deadlines, late increments and forged creator signatures through real network services. `conditional-vault-ui-acceptance.ts <network> <account> <000id> <run>` drives the funded UI in an isolated Chrome context with private recovery backups. These runners use registered test accounts and must not run in ordinary credential-free CI. Never record their browser storage, screenshots, traces or signed requests.

The browser runner's `--lose-claim-ack` option forwards the real Claim but withholds its response, then requires actual receipt recovery and a repeated Claim without another financial POST. Its focused run omits redundant intermediate public Checks; the separate ordinary runs cover those. `conditional-vault-ui-verify-ack.ts <network> <run>` can verify an existing fault-requested or already-attested lost-response record without creating replacement funding. The older `conditional-vault-live.ts` command delegates to the maintained grant-checked acceptance runner and now requires explicit `--network`, `--account`, `--id` and `--run` arguments instead of inventing a new ID after a failed request.
