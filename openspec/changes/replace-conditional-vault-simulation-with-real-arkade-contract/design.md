# Design

## Context

The Prototype Sandbox currently presents Conditional Vault as a local state machine with real-looking wallet output. The implementation must instead use the existing Arkade wallet/session abstractions and the operator selected by the title-bar network selector. See `proposal.md` and the delta specs for the required user-visible behavior.

## Goals / Non-Goals

**Goals:**

- Implement a compact real Arkade contract with a creator, 100-sat value, progress state, and terminal claim.
- Preserve the four-call teaching flow: Create, Increment, Check, Claim.
- Use the selected network and its existing funded test-wallet profile for live acceptance on Signet and MutinyNet.
- Make the Create page explain the relationship between readable builder source, generated script, and compiled artifact.
- Keep status inspection public and keep secrets out of UI, logs, and artifacts.

**Non-Goals:**

- No general-purpose contract framework or arbitrary JavaScript-to-contract compiler.
- No browser-local source of truth for contract identity, progress, funding, or claim state.
- No immediate Bitcoin L1 settlement requirement; Arkade virtual contract operations are the primary demo path, with any settlement/unilateral exit shown only when provided by the SDK.
- No changes to unrelated payment, asset, wallet, or marketplace demos beyond shared network/session compatibility.

## Decisions

### Contract representation

Use the Arkade contract representation supported by the installed SDK/compiler rather than inventing a JavaScript state machine. Keep the human-readable builder/contract source alongside the generated script and compiled artifact. The artifact must be the value passed to the Arkade contract APIs; the UI must not label a sketch or pseudocode as executable.

### State transition model

Represent progress as contract state recreated by valid spends. Create produces the initial funded state. Increment spends that state into the next state until progress three. Claim spends only the progress-three state to the creator. Check derives its result from wallet/operator contract evidence and does not require a signer.

### Wallet and network selection

Resolve the active network at each operation boundary, then obtain the matching existing test-wallet session and operator. Do not reuse HD repositories or derived descriptors across network or mnemonic identity changes. Persist only sanitized contract metadata needed for later lookup; treat operator evidence as authoritative.

### Duplicate IDs and idempotence

Use the vault ID as an application-level lookup key bound to the contract identity and network. Create checks existing verifiable records and rejects an occupied ID before funding. Repeated Increment, Check, and Claim calls re-read current evidence and return a truthful no-op or terminal result instead of fabricating a second transition or payout.

### Presentation

Create uses a segmented Demo / Smart Contract view. The Smart Contract view contains readable builder source, generated script/disassembly, and compiled artifact with explicit labels. The other three pages show only their integration source and live operation output.

### Verification

Unit tests cover deterministic contract construction, state validation, duplicate IDs, repeated calls, network separation, and sanitized output. Live acceptance uses the repository's existing funded test-wallet flow on Signet and MutinyNet, records only public evidence, and fails clearly when operator fees or wallet funding are unavailable.

## Risks / Trade-offs

- [SDK contract API differs from the proposal] → Inspect the installed SDK and compiler before coding; adapt the design only through a documented artifact update if a required transition cannot be represented.
- [Testnet operator fee estimation or funding is unavailable] → Keep live acceptance separate from deterministic tests and report environmental failure without passing a mock.
- [Stateful contract outputs are eventually consistent] → Re-read operator evidence after submissions, expose pending/unknown states, and prevent duplicate spends while unresolved.
- [Compiled artifact is too technical for the demo audience] → Lead with builder source and generated script, while keeping raw artifact available as an expandable inspection section.

