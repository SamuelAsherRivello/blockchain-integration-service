# conditional-vault-contract Specification

## Purpose

Provide a real Arkade covenant-backed Conditional Vault demonstration whose funds, progress, claim rules, expiry, and recovery are enforced by network-backed contract outputs on both supported test networks.

## Requirements

### Requirement: Immutable vault rules
The Conditional Vault SHALL be created from an immutable contract program whose spending rules, creator identity, amount, terminal progress, and deadline are committed into the contract output. Browser-local state SHALL never be the authority for whether funds may move.

#### Scenario: Contract source is inspectable
- **WHEN** the user opens Create's Smart Contract tab
- **THEN** the demo shows the actual contract builder source and the generated TapScript/compiled artifact used for the network operation
- **AND** it does not label pseudocode as an executable contract

#### Scenario: Local state is lost
- **WHEN** browser storage is cleared or a new browser session opens
- **THEN** Check reconstructs the vault from network/indexer evidence or reports unavailable
- **AND** it does not create a replacement vault or claim based on the old local counter

### Requirement: Network-backed vault creation
Create SHALL fund a new vault output through the active Signet or MutinyNet Arkade operator and SHALL persist enough sanitized recovery metadata to reconcile the submitted operation. A duplicate vault identifier SHALL fail without submitting a replacement funding transaction.

#### Scenario: Create on the selected network
- **WHEN** the user selects a supported network and executes Create with a funded creator wallet
- **THEN** the operation uses that network's configured operator, creates the covenant-controlled output, and reports pending or confirmed evidence with its transaction reference
- **AND** no local-only success is shown

#### Scenario: Duplicate Create
- **WHEN** Create is called for an identifier with an existing unresolved or resolved vault record
- **THEN** it returns `Error: VaultID <value> is already taken.` for that network, creator, and contract version
- **AND** it does not spend funds or overwrite the existing record

#### Scenario: Network mismatch
- **WHEN** the selected network, active wallet network, or operator-reported network differs
- **THEN** Create fails before signing or submission with a safe network-mismatch reason
- **AND** it does not persist a successful vault

### Requirement: Permissionless valid increment
Increment SHALL be a real contract spend that advances exactly one valid vault state and creates the next covenant-controlled output. It SHALL permit public submission without the creator's mnemonic, while preserving creator-only claim authority.

#### Scenario: Increment advances state
- **WHEN** a valid funded vault is at progress `n` where `n < 3`
- **THEN** Increment submits a real transition to `n + 1`
- **AND** the resulting output remains controlled by the vault rules

#### Scenario: Invalid increment is rejected
- **WHEN** Increment targets a missing, expired, claimed, already-terminal, or otherwise invalid state
- **THEN** the contract or verified operation path rejects it
- **AND** no local progress value is advanced

#### Scenario: Increment is repeatable
- **WHEN** Increment is called more than once for the same state or operation
- **THEN** the first accepted transition remains the only transition and later calls return a truthful already-pending, already-applied, or invalid-state result
- **AND** no duplicate spend is submitted

### Requirement: Network-backed public inspection
Check SHALL be read-only and SHALL derive vault status, progress, expiration, funding state, terminal state, and transaction references from verified network/indexer evidence. It SHALL work without a mnemonic and SHALL be callable repeatedly.

#### Scenario: Public Check
- **WHEN** a public-address-only user checks a vault
- **THEN** the demo returns the current verified state without signing or submitting funds
- **AND** the response identifies the active network and whether evidence is confirmed, pending, unavailable, or stale

#### Scenario: Check after refresh
- **WHEN** Check is called repeatedly or after a page refresh
- **THEN** it returns the same network-derived state until new evidence exists
- **AND** it does not create, increment, or claim the vault

### Requirement: Creator-only terminal claim
Claim SHALL spend only a verified progress-3 vault output and SHALL require the creator's signing identity. The vault SHALL preserve and return its 1000-sat principal. Any applicable fees SHALL be quoted and funded separately, or the operation SHALL report unsupported terms before new funding.

#### Scenario: Claim after completion
- **WHEN** the creator claims a funded vault whose verified progress is `3` and whose deadline permits claiming
- **THEN** the contract spend is submitted and the vault becomes claimed only after receipt reconciliation
- **AND** the returned funds are attributed to the creator wallet

#### Scenario: Claim before completion
- **WHEN** the creator claims a vault whose verified progress is below `3`
- **THEN** the operation is rejected without spending the vault or changing its state

#### Scenario: Non-creator claim
- **WHEN** another wallet attempts Claim
- **THEN** signing or contract validation rejects the spend
- **AND** the vault remains claimable only by its creator when otherwise eligible

### Requirement: Enforceable deadline and recovery paths
The vault SHALL define enforceable claim and recovery behavior for its deadline. A client countdown MAY explain the deadline but SHALL not be the only enforcement. Expired, uncertain, and operator-unavailable states SHALL remain recoverable and truthful.

The approved deadline SHALL apply at co-signer execution and acceptance for signing, using its UTC clock. A request accepted before expiry MAY confirm afterward. The demo SHALL NOT describe this as a Bitcoin-level upper bound on settlement or signature validity. Persistent local Docker co-signers SHALL satisfy local Vite infrastructure requirements; this change does not claim a public HTTPS deployment.

#### Scenario: Expired vault
- **WHEN** a vault reaches its contract-defined deadline before a valid claim
- **THEN** Claim is rejected by the contract path and Check reports expired
- **AND** any refund or recovery path is exposed only when its contract and operator conditions permit it

#### Scenario: Lost submission acknowledgement
- **WHEN** Create, Increment, or Claim submits but the acknowledgement is lost
- **THEN** the operation is marked unknown or pending and later Check/reconcile inspects the original transaction and outputs
- **AND** retry never creates a competing spend

### Requirement: Active-network parity
The complete Conditional Vault flow SHALL use the title-bar network selector and SHALL pass the same behavioral contract on Signet and MutinyNet. The implementation SHALL fail closed when an operator lacks the required contract capability rather than falling back to local simulation.

#### Scenario: Signet acceptance
- **WHEN** the registered Signet test wallets execute Create, Increment through 3, Check, and Claim
- **THEN** every transition is observed through the Signet operator/indexer and the final claim is reconciled
- **AND** negative-path and recovery cases pass without synthetic outcomes

#### Scenario: MutinyNet acceptance
- **WHEN** the registered MutinyNet test wallets execute the same sequence
- **THEN** every transition is observed through the MutinyNet operator/indexer and the final claim is reconciled
- **AND** negative-path and recovery cases pass without synthetic outcomes

#### Scenario: Unsupported operator capability
- **WHEN** either selected operator cannot support the required covenant operation
- **THEN** the demo reports a specific unavailable capability
- **AND** it does not advertise a working contract, submit a wallet-owned substitute, or advance local state

### Requirement: Production-quality evidence and presentation
The demo SHALL expose sanitized operation evidence, safe errors, and deterministic call behavior. Isolated tests MAY model provider responses, including success, but SHALL NOT count as contract execution or live acceptance. Completion SHALL require executable contract tests and funded live acceptance on both networks.

#### Scenario: Safe result presentation
- **WHEN** any call succeeds, fails, remains pending, or is unavailable
- **THEN** the console and output identify the demo first, show the result and evidence state, and end with the corresponding success boolean
- **AND** no mnemonic, private key, signed proof, or raw provider payload is shown

#### Scenario: Completion gate
- **WHEN** the change is reviewed for completion
- **THEN** the review includes the contract artifact, network transaction references, both-network acceptance results, negative-path results, recovery results, and build/test results
- **AND** any unperformed live case keeps the change incomplete

### Requirement: Documentation and setup prerequisite
Implementation SHALL follow the complete current official Contracts documentation and complete the official setup guide with the repository's package conventions and supported networks. Documentation examples SHALL NOT supply live wallet identities or override the selected network.

#### Scenario: Setup verification
- **WHEN** the implementation environment is prepared
- **THEN** a dated inventory covers every Contracts page and linked advanced contract material
- **AND** a read-only setup smoke check verifies explicit dependencies, SDK imports, encoding, script compilation, and both configured providers using protected registered test-wallet access where needed
- **AND** setup success does not count as funded acceptance

### Requirement: Portable public contract inspection
The vault SHALL provide a versioned public descriptor sufficient to locate and validate its contract outputs without a mnemonic. Its contents SHALL be checked against the compiled scripts and network funding evidence. Missing outputs or a locally saved transaction ID SHALL NOT establish a terminal claim.

#### Scenario: Clean public browser
- **WHEN** a fresh browser imports the exported descriptor and calls Check
- **THEN** it verifies the descriptor, traverses funding and spending evidence, and returns the current contract state without a signing identity
- **AND** incomplete evidence reports unavailable or pending, rather than claimed

#### Scenario: Descriptor tampering
- **WHEN** an imported descriptor changes creator, network, deadline, state script, or funding outpoint inconsistently
- **THEN** verification rejects it and no mutation becomes available

### Requirement: Trusted service configuration
Contract creation SHALL use explicit per-network service configuration with independently pinned emulator signer identity. Existing vaults SHALL retain the original signer and script parameters through service rotation. Runtime endpoint availability SHALL NOT substitute for contract execution evidence.

#### Scenario: Signer mismatch
- **WHEN** the emulator advertises a key different from the configured pin
- **THEN** new funding fails before signing and existing vault recovery data remains intact

#### Scenario: Alternate service compatibility
- **WHEN** a published service is unavailable and a self-hosted emulator is configured for Signet
- **THEN** the integration verifies real Signet operator compatibility with a funded valid transition and rejection of an invalid transition before advertising readiness

### Requirement: Scoped identifiers and repeated operations
The vault SHALL scope display identifiers by network, creator, and contract version, retain original funding history, and identify each mutation by operation ID and expected outpoint. Replaying an operation SHALL reconcile it; a fresh explicit increment MAY advance the next state.

#### Scenario: Duplicate clicks and another tab
- **WHEN** two tabs submit the same creation intent or increment the same outpoint
- **THEN** coordination prevents duplicate submission where supported and reconciles competing results against network evidence
- **AND** uncertain or multiple funding outputs are reported explicitly without selecting an arbitrary output

#### Scenario: Historical or unknown identifier
- **WHEN** an ID has historical funding or incomplete evidence of a prior attempt
- **THEN** Create rejects a known duplicate or requires reconciliation of uncertainty
- **AND** it makes no unsupported claim of globally atomic unique IDs across disconnected browsers

### Requirement: Expiry recovery and read-only checks
The contract SHALL provide explicit creator-authorized recovery after expiry from every funded progress state. Check SHALL perform no transaction submission, finalization, or rebroadcast. Cooperative deadline enforcement and unilateral Bitcoin exit guarantees SHALL be documented and verified separately.

#### Scenario: Expiry in each state
- **WHEN** a funded vault expires at progress 0, 1, 2, or 3
- **THEN** late claim and increment are rejected by contract execution
- **AND** the creator can invoke the documented recovery operation under its actual spend conditions and fees

#### Scenario: Pending transaction inspection
- **WHEN** Check observes an unfinished submission
- **THEN** it reports verified pending or unknown state without signing, finalizing, or resubmitting

### Requirement: Adversarial execution verification
Contract acceptance SHALL test actual compiled bytecode and every spend branch independently of UI authorization checks. It SHALL reject altered destinations, amounts, deadlines, skipped states, invalid signatures, and unauthorized direct submissions within the documented Arkade trust model.

#### Scenario: Bypassed UI validation
- **WHEN** a test constructs a forbidden spend directly through the VM or operator API
- **THEN** execution rejects it without changing the funded output
- **AND** an application-side validation error alone does not satisfy this test
