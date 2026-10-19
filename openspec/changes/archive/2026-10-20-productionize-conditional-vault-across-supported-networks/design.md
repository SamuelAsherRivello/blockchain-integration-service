# Design

## Context

See proposal.md for the motivation and required outcome. The existing prototype Conditional Vault has a presentational flow, local progress/state behavior, and some real wallet operations, but it is not a complete covenant-backed state machine. The repository already has network-scoped Arkade wallet providers, operation journals, contract recovery patterns, registered test-wallet tooling, and a public game-facing API boundary that must be preserved.

The target is a four-call demo:

```
Create  -->  Increment  -->  Check  -->  Claim
  |             |             |          |
  v             v             v          v
fund state 0  state 1..3   public read  creator spend
```

The contract must be valid on both configured test networks. Arkade operations are operator-mediated off-chain transactions backed by VTXO scripts; “real” here means the operator accepts and the indexer verifies the covenant-controlled outputs, not that every click creates an immediate Bitcoin L1 transaction.

## Goals / Non-Goals

**Goals:**

- Use one immutable vault covenant for the supported network pair, with network-specific operator keys and policy inputs where required.
- Encode progress as spendable contract state so the operator and signer cannot accept an invalid transition.
- Keep Create and Claim creator-signed; keep Check public and read-only; implement Increment according to the confirmed permission model, with permissionless valid increments if the contract permits them.
- Preserve the existing public BIS API boundary and expose provider-neutral Conditional Vault DTOs.
- Reconcile uncertain submissions from exact original inputs/outputs and never retry by constructing a replacement spend.
- Make live acceptance with registered test wallets the completion gate for each network.

**Non-Goals:**

- No browser-only fallback, local-only contract, wallet-owned address substitution, or simulated successful transaction.
- No arbitrary JavaScript execution inside a contract.
- No general-purpose contract language or contract factory in this change.
- No production mainnet deployment or permanent production funding.
- No requirement that the public Check call possess private wallet material.

## Decisions

### Approved operational updates, 2026-10-19

The user approved a principal of 1,000 sats, replacing the earlier 100-sat requirement after live dust-policy rejection. Existing 100-sat records retain their original parameters and recovery data. New version-5 vaults preserve exactly 1,000 sats and commit the operator's canonical principal/extension/anchor output order. Experimental version-4 contracts retain their original scripts and recovery data and are never silently recompiled as version 5. The user authorized onboarding Bitcoin held by registered test accounts for real acceptance testing.

Persistent local Docker co-signers are approved for the local Vite demo on both networks as needed. Public hosting and production HTTPS deployment are not required by this local-demo acceptance and are not claimed. Browser access still needs verified localhost or same-origin proxy transport.

The 120-second upper bound applies when the co-signer executes and accepts a request for signing. A spend accepted before the deadline may confirm later. Bitcoin L1 does not enforce an upper-bound expiry on an already issued signature. CHECKTIME uses the co-signer's UTC clock, so clock synchronization is a service trust assumption. Recovery becomes eligible at the same immutable deadline. Tests must distinguish request acceptance from later transaction confirmation.

### 1. Use successive covenant-controlled outputs for progress

The vault will represent state as a sequence of outputs whose scripts commit to the vault identity, creator key, amount, deadline, and current progress. An Increment consumes state `n` and creates only state `n+1`; the script or contract validation rejects skips, rewinds, terminal increments, and output substitutions. Claim consumes only state `3` and pays the creator-controlled destination.

This is preferred over a browser counter because it makes state observable and enforceable. A mutable local ledger may index and recover operations, but it cannot authorize a spend.

Alternative rejected: keeping a single output and storing progress in local metadata. That cannot enforce the progression rule on the network.

### 2. Separate contract compilation from demo orchestration

The Arkade integration layer will own contract construction, script encoding, spend preparation, signing, submission, output verification, and recovery. The core layer will own provider-neutral request/result DTOs and lifecycle guards. The prototype sandbox will call the public demo API and render source/evidence; it will not import Arkade-specific types or reconstruct contract state.

Create will expose three source views: demo TypeScript, human-readable contract-builder TypeScript, and generated TapScript/compiled bytes. Increment, Check, and Claim will expose their demo source and sanitized operation evidence.

### 3. Resolve network infrastructure while continuing independent work

Split discovery into a read-only service probe and an explicit funded compatibility test. HTTP 200 and SDK exports establish availability, not spend compatibility. HTTP 404 at a guessed hostname establishes only that the particular route is unavailable. Query official deployment sources and configured service metadata before concluding that a network lacks support.

When Signet has no suitable published service, prepare the upstream emulator with its Ark provider pointed at the actual Signet operator. Pin its release/image digest and signer key, verify emulator-to-operator connectivity and previous-transaction resolution, then exercise a minimal funded contract and a rejected invalid transition. A local regtest chain is useful for tests but does not satisfy Signet acceptance. A service answering `/v1/info` alone does not satisfy this gate either.

Build and test contracts, recovery, UI, and the available network in parallel with infrastructure resolution. Block only the dependent funding or publication step. If deploying a remote service requires missing hosting access or ongoing service ownership, prepare the runnable configuration and report that concrete remaining dependency. Do not claim that this plan can control an external operator's policy.

The selected network is passed through every provider, storage scope, explorer link, journal key, and recovery query. Provider responses must match the requested network before signing or persistence of success.

### 4. Keep increment permissionless and claim creator-signed

Any participant holding the public descriptor may advance the vault one state through the emulator/operator covenant path without the creator's mnemonic. Create and Claim use the creator wallet. The UI may execute Increment from the private-wallet demonstration, but the contract must not depend on that wallet's permission. Verify permissionless Increment using a separate public client and reject direct operator submissions that omit required covenant signatures. Creator-only Claim requires a creator signature as well as the covenant's destination/value checks.

### 5. Keep application deadline and contract recovery distinct

Committing a deadline value is insufficient unless executing a spend validates it. Prove the pinned emulator's `CHECKTIME` or equivalent time instruction and its comparison semantics with boundary tests before choosing the bytecode. A lower-bound CLTV/CSV refund does not prohibit a late claim. Do not present it as an upper-bound deadline. The deadline and time source must remain constant through all four states, including retries and service restarts. Any inability to implement the required upper bound is an unresolved compatibility failure, not permission to use the browser clock as enforcement.

The 120-second duration from the earlier escrow discussion is a proposed vault default, not evidence of an implemented vault timer. It must be documented as a vault parameter rather than silently reset. Expired vaults retain a creator-authorized recovery path distinct from successful progress-3 Claim. Recovery must be available from every funded state, not only state 0. Since four primary navigation calls were requested, expose recovery explicitly in expired vault details rather than hide a refund inside public Check. Document the difference between cooperative Arkade rules and Bitcoin L1 exit rules; any emergency exit that bypasses progress must be identified and tested.

### 6. Use durable operation journaling and exact receipt verification

Every mutation persists its original scope, inputs, intended outputs, operation ID, contract state, and submission checkpoints before provider submission. Reconciliation queries the original transaction/outpoints and verifies scripts, values, state, and destinations. A pending or unknown operation blocks competing spends until its exact result is known.

### 7. Treat both networks as separate acceptance targets

Unit tests cover deterministic scripts and state transitions. Provider integration tests cover mocked failures and response mismatches. Live tests use the registered test-wallet harness independently on Signet and MutinyNet, with isolated storage and no secret output. The final report must include transaction references and explicit pass/unavailable evidence for every call and negative path on each network.

## Risks / Trade-offs

- [Operator lacks covenant support on one network] -> Fail closed, record the exact capability result, and do not mark the change complete until that operator is upgraded/configured or replaced with an approved compatible operator.
- [Arkade VTXO/batch expiry races a multi-step demo] -> Persist recovery metadata, reconcile before every competing spend, and test interruption between every submission checkpoint.
- [Permissionless increment allows griefing or premature completion] -> Encode the maximum/terminal state and deadline in the covenant; document that increments are public and make claim authority independent.
- [State-output encoding differs between SDK versions] -> Pin and verify the SDK contract API before implementation; compile fixtures and compare exact scripts/trees in CI.
- [Test-wallet funds or operator fees are unavailable] -> Report live acceptance as unavailable rather than substituting fixtures; keep credential-free tests separate from financial acceptance.
- [A contract source view becomes misleading] -> Render the exact builder source and generated artifact captured from the implementation, with labels distinguishing source, script, and compiled bytes.

## 10 Technical Blockers and Preventive Solutions

1. **The public operator does not support the required covenant flow.**
   - Prevention: run the capability probe against Signet and MutinyNet before implementation.
   - Solution: use a verified compatible operator configuration or upgrade the operator/SDK integration. If neither is available, expose a network-specific unavailable result and keep the change incomplete; never substitute a wallet-owned address or local state.

2. **The pinned Arkade SDK cannot express the required state transition.**
   - Prevention: inspect the actual installed SDK exports and compile a state-0/state-1 fixture before building the UI.
   - Solution: use the SDK's supported low-level script/provider primitives or make a reviewed SDK upgrade. Do not invent an adapter that claims to compile arbitrary JavaScript into a contract.

3. **Progress is not actually enforceable by the covenant.**
   - Prevention: model progress as successive covenant-controlled outputs and test the exact input/output scripts for every transition.
   - Solution: reject any design that stores progress only in local metadata. The implementation is complete only when the contract itself rejects skipped, rewound, terminal, and substituted-output transitions.

4. **Taproot/script-size, minimum-output, fee, or asset constraints make the contract unspendable.**
   - Prevention: measure the compiled script/tree, operator minimums, fee policy, VTXO limits, and change behavior on both networks before funding.
   - Solution: keep the contract minimal, validate the 1000-sat principal against the actual VTXO minimum, require proven separately funded fees, reject unsupported asset-bearing inputs, and test exact value preservation before live submission. Do not silently change the requested principal to work around Bitcoin dust policy.

5. **Signet and MutinyNet differ in operator keys, policy, endpoints, or contract behavior.**
   - Prevention: scope every script parameter, provider, journal, explorer link, and storage key by the selected network and verify the operator-reported network.
   - Solution: maintain explicit per-network capability results and adapters. Run the complete acceptance matrix independently; a pass on one network cannot satisfy the other.

6. **Wallet HD identity, descriptor, or wallet-mode mismatches prevent signing.**
   - Prevention: bind every wallet session to mnemonic identity, network, descriptor, and profile before deriving addresses or signing.
   - Solution: create isolated network/profile sessions, invalidate stale cached state on identity changes, and fail with a sanitized identity-mismatch diagnostic instead of reusing incompatible HD state.

7. **Registered test wallets lack suitable spendable inputs or operator terms change.**
   - Prevention: preflight wallet readiness, exact network, spendable VTXOs, reservations, minimum amount, and current fee/policy before Create.
   - Solution: replenish or rotate only the approved private test-wallet fixtures, wait for spendability, and report unavailable/insufficient funds without submitting a partial or simulated vault.

8. **Lost acknowledgements or retries create competing spends.**
   - Prevention: persist operation scope, input outpoints, intended outputs, and checkpoints before submission; reserve inputs by operation ID.
   - Solution: reconcile the original transaction and outputs through the indexer, classify the operation as pending/confirmed/failed, and block replacement submissions until the original result is known.

9. **VTXO/batch expiry or operator downtime interrupts the multi-step sequence.**
   - Prevention: distinguish the vault deadline from Arkade batch expiry and test interruption at every submission boundary.
   - Solution: persist contract recovery data, provide explicit Check/Reconcile, use only valid contract recovery branches, and report operator-unavailable or expired states truthfully. Do not extend a deadline from a browser timer or silently restart the vault.

10. **Tests pass without proving the real two-network flow.**
    - Prevention: separate deterministic/unit tests, credential-free browser checks, and funded live acceptance; require transaction/output evidence for the latter.
    - Solution: run the registered-wallet sequence independently on Signet and MutinyNet, record sanitized transaction references and negative-path results, and prohibit completion while either network is unperformed, pending, or simulated.

## Migration Plan

1. Run read-only service discovery, compile adversarial contract fixtures, and resolve network infrastructure alongside independent implementation. Require a funded compatibility proof before user funding on each configuration.
2. Implement the contract builder and deterministic state-transition fixtures.
3. Implement Arkade funding, increment, inspection, claim, and recovery behind the existing provider-neutral API.
4. Replace the prototype's local Conditional Vault actions and remove any success-producing local fallback.
5. Add the source/artifact tabs and evidence output.
6. Run unit, integration, build, and live acceptance gates separately for Signet and MutinyNet.
7. If deployment must be rolled back, hide the demo behind an explicit unavailable capability rather than re-enabling simulation. Existing local demo records remain non-authoritative and must not be presented as real vaults.

## Evidence and implementation corrections

### Required documentation review and setup

Before writing vault transaction code, enumerate the current Contracts & Apps section from the live navigation and [documentation index](https://docs.arkadeos.com/llms.txt), then read each complete page, including examples and caveats. The inventory found on 2026-10-19 includes:

- [Deep dive](https://docs.arkadeos.com/contracts/deep-dive)
- [Setup](https://docs.arkadeos.com/contracts/setup)
- [Escrow Contract](https://docs.arkadeos.com/contracts/escrow)
- [Hash Time Locked Contract](https://docs.arkadeos.com/contracts/hashlock)
- [Spilman Channel](https://docs.arkadeos.com/contracts/spilman-channel)
- [Dryja-Poon Channel](https://docs.arkadeos.com/contracts/dryja-poon-channel)
- [Lightning Swaps with Boltz](https://docs.arkadeos.com/contracts/lightning-swaps)
- [Lightning Channels](https://docs.arkadeos.com/contracts/lightning-channels)
- [Chain Swaps with Boltz](https://docs.arkadeos.com/contracts/chain-swaps)
- Linked advanced material: [Arkade Compiler](https://docs.arkadeos.com/experimental/arkade-compiler), [Arkade Functions](https://docs.arkadeos.com/experimental/arkade-functions), and [Non-Interactive Swaps](https://docs.arkadeos.com/experimental/non-interactive-swaps).

Refresh this inventory at implementation time and include any newly listed Contracts pages. Record read date, canonical URL, relevant constraints, retirement notices, and differences from the pinned SDK. Retired examples are references only. The review must distinguish Bitcoin Tapscript contracts from emulator-dependent output-introspection covenants; a working escrow example is not proof that the counter can execute on the same configuration.

Complete the setup guide using this repository's npm workspace conventions. Verify `@arkade-os/sdk` and `@scure/base` are explicit dependencies of the package importing them, pin compatible versions in the lockfile, and use scure encoding plus the SDK transaction class. Reuse registered encrypted test-wallet identities, never documentation example phrases. Instantiate the Ark and indexer providers from the active BIS network selector, validate server identity/network and compressed-to-x-only public-key conversion, and compile/re-derive the helper scripts. Do not copy the guide's example mainnet endpoint into the testnet configuration. Validate the setup from a clean install and repeat provider reads for both test networks.

Keep the setup smoke test read-only. Its passing result proves dependencies, imports, encoding, script construction, and provider access only. The contract execution tests and funded live acceptance remain separate mandatory gates. Reading this plan does not mark the documentation review or environment setup complete.

The following facts were inspected on 2026-10-19. They are planning evidence, not funded acceptance:

- SDK 0.4.79 exposes `Arkade.connect`, `Program`, `ArkadeContract.register`, covenant transaction builders, `CHECKTIME`, output-value inspection, and output-script inspection. Its declarations require an emulator plus indexer for `arkadeScript` spends and explicitly allow a configured self-hosted emulator key for Signet. Inspect `node_modules/@arkade-os/sdk/dist/index.d.ts` around `ArkadeConnectOptions` during implementation; presence of an opcode is not proof of its runtime semantics.
- Both current operator info endpoints report `vtxoMinAmount = 1`, `vtxoMaxAmount = -1`, `dust = 330`, and zero transaction fee rate. Signet intent fees are empty strings; MutinyNet uses `0.0`. Preserve BIS's normalized fee parsing and unlimited-maximum sentinel semantics. The 330-sat Bitcoin dust field must not be confused with the 1-sat VTXO minimum. A 1000-sat off-chain output is not ruled out by these info values, but real contract submission still needs testing.
- Existing `conditional-vault.ts` obtains `emulatorPubkey` from the service it is about to trust, uses local metadata for duplicate detection, and uses a local `claimTxid` as terminal evidence when no output is found. These are specific replacement targets.
- Existing fixture tests check strings and serialization, not actual covenant execution. The separate treasure script has an application-level deadline and is not evidence for a covenant-enforced deadline or counter.

Primary implementation references: [upstream emulator](https://github.com/arkade-os/emulator), [SDK](https://github.com/arkade-os/ts-sdk), and [compiler](https://github.com/arkade-os/compiler). Pin the versions used for tests; the upstream emulator describes its protocol as alpha for testnet experimentation. Production quality in this change means tested application behavior and operated testnet infrastructure, not a claim that upstream has completed a mainnet security audit.

## Additional design constraints

### Trusted configuration and immutable descriptors

Store an allowlisted emulator endpoint and independently pinned signer key per network. Compare `/v1/info` with that pin before compiling or funding. Persist original operator/emulator keys and script versions with each vault so rotation cannot change its address. Preserve access to the original signer for unresolved vaults. A replacement service must prove compatibility; do not automatically trust its newly reported key.

The public descriptor contains schema version, network, creator public key/destination, ID suffix, amount, fixed deadline, operator key, emulator key, all state scripts, and original funding outpoint. It contains no mnemonic, secret, or signed transaction. Export/import it with a canonical hash, recompile scripts to validate it, and verify its claimed outpoint against the indexer. A fresh browser imports this descriptor then queries network evidence. An Arkade address alone does not contain constructor parameters; do not promise universal vault discovery from that address or from `0000` alone. Durable private recovery packages remain encrypted and separate from public inspection data.

### ID scope and competing funding

Namespace the four-digit display ID by network, creator public identity, and contract version. Exact duplicate errors are `Error: VaultID 0000 is already taken.` Different creators may use the same suffix. Persist an atomic creation intent before broadcast, use origin-scoped cross-tab locking, inspect known historical funding/spends, and retain tombstones and recovery records. If evidence is incomplete, refuse a new submission until reconciliation. Public VTXOs do not establish a global unique-ID registry; no global uniqueness is claimed. Different disconnected devices cannot obtain atomic uniqueness from browser locks alone. Import the original descriptor to resume; flag ambiguous or multiple funding outputs rather than pick an arbitrary coin.

### Principal, fees, and recovery economics

Preserve exactly 1000 sats through state 0, 1, 2, and 3 and return that principal to the creator. Quote fees separately before funding, reserve their funding source, and display network and fee amounts. Under the observed zero-fee policy the principal needs no reduction. A nonzero policy requires a proven separately funded fee mechanism; otherwise block new funding through that policy without rewriting an existing covenant amount. Bitcoin exit of a sub-dust principal may require additional fee/dust funding. Test and document that requirement and the actual exit package instead of promising a cost-free independent L1 exit for 1000 sats.

### Validate actual scripts, branches, and receipts

Construct states backwards, with the creator-only claim only in state 3. Nonterminal states have increment and explicitly defined recovery branches. Validate segwit version as well as witness program when inspecting destinations, exact principal/input amount, output indices/counts including the SDK extension, permitted fee inputs/change, and absence of unintended asset flows. Constrain every spending branch, not only the happy-path function. Reject duplicate or ambiguous active states and never select `utxos[0]` without provenance checks.

Verify funding linkage and every spent input/output through exact transaction evidence, traversing spent history to distinguish claimed, recovered, expired-but-unspent, and unavailable. Missing live outputs are not evidence of a claim. Check performs network reads and local cache refresh only; finalization or rebroadcast belongs to an explicitly authorized mutation/recovery action. Indexer outage or eventual consistency yields pending/unknown, not empty success. Store a signed transaction before transmitting it only in protected recovery storage. Never print it, return it through public DTOs, or put it in ignored diagnostic reports.

### Idempotency, tests, and release ownership

Bind Increment retry to a specific operation ID and expected current outpoint. Replaying that operation returns its existing result; a fresh explicit Increment action may advance the next state. This distinction prevents accidental advancement twice after a lost response while allowing the requested three increments. Repeat Claim reconciles its original spend and returns already-claimed when verified.

Exercise actual bytecode in a pinned upstream VM plus real operator integration. Synthetic success responses may exist in isolated unit tests to exercise application branches, but never satisfy contract execution or live acceptance. Adversarial tests must bypass UI checks and attempt wrong-state claims, creator spoofing, altered amount/destination/time, extra outputs, double use of an input, descriptor tampering, untrusted signer rotation, and direct operator submission without emulator authorization. Review cooperative trust and unilateral exit guarantees separately.

Use root commands that actually exist: `npm run typecheck`, `npm test`, and an explicit prototype-sandbox workspace build. Verify their test discovery includes the sandbox and live runner. Do not invent a lint or archive-verification command as a completion gate; identify the applicable existing command or explicitly add one during implementation with its tests. Keep a maintained acceptance summary with public transaction references in tracked documentation, while raw diagnostic reports stay in `output/`.

This change is the authority for the replacement Conditional Vault work. Reuse verified code from the earlier changes, reconcile their overlapping tasks before eventual archival, and preserve any previously funded contract's original spend/recovery path. Never reinterpret an old local record as a funded vault or delete uncertain financial records during migration.
