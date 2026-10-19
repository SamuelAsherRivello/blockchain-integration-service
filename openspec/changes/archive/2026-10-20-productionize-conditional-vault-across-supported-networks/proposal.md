# Proposal

## Why

The Conditional Vault demo currently presents a smart-contract-shaped flow while its progress state is partly controlled by browser-local state and its real network behavior has not been proven across both supported test networks. That creates a misleading developer experience: a user can see Create, Increment, Check, and Claim without seeing whether the Arkade operator actually enforces the vault rules.

This change will make the demo a production-quality, network-backed Arkade contract example. Completion requires real covenant-controlled state transitions, truthful recovery and error handling, and live acceptance on both Signet and MutinyNet using the repository's registered test-wallet flow.

## What Changes

- Read every page in the official Contracts section, including linked experimental compiler/function material, and complete the official [Contracts setup](https://docs.arkadeos.com/contracts/setup) against this repository before implementing vault transactions. Record a dated documentation inventory and executable setup checks.
- Replace the local Conditional Vault state machine with an immutable Arkade covenant/contract program.
- Fund the contract during Create through a real Arkade transaction.
- Represent progress as contract-controlled state transitions rather than a React, session-storage, or local-ledger counter.
- Make Increment a real, validated transition and define whether it is permissionless or signer-authorized in the contract itself.
- Make Check read and reconcile the active contract output through the network/indexer without submitting funds.
- Make Claim spend only the terminal state and return the locked sats to the creator through the contract's valid spend path.
- Encode the deadline and recovery/refund behavior in enforceable contract paths; do not use a client countdown as the financial rule.
- Bind every operation to the title-bar network selector and reject network/operator mismatches before signing or submission.
- Preserve idempotency, uncertain-submission recovery, duplicate-call fallbacks, and safe diagnostics across refreshes, restarts, wallet changes, and operator failures.
- Show the actual TypeScript contract builder and generated TapScript/compiled artifact for Create; show the real demo integration source for the other calls.
- Add live acceptance using the existing registered Signet and MutinyNet test accounts. Tests must distinguish confirmed, pending, unavailable, failed, and unperformed states.
- Do not claim the feature is complete unless both networks execute the full funded sequence and all negative-path checks without a simulation fallback.
- Resolve missing contract infrastructure as implementation work: verify published endpoint/configuration sources, then prepare a reproducible upstream emulator deployment for Signet if required. Independent contract, recovery, UI, and MutinyNet tasks continue while that dependency is resolved.
- Preserve the demo's 1000-sat principal and three increments, make increment permissionless, and use a portable public contract descriptor for inspection without mnemonic access. Define ID scope, concurrency, fee funding, signer pinning, and terminal receipt verification explicitly.

## Capabilities

### New Capabilities

- `conditional-vault-contract`: A real Arkade covenant-backed vault with immutable rules, state transitions, inspection, claim, recovery, and truthful lifecycle reporting.

### Modified Capabilities

None. The Conditional Vault contract boundary will own the new behavior while reusing existing account-contract, network-policy, and test-wallet guarantees. Existing capabilities will only receive implementation changes where needed to satisfy this new contract boundary; their durable requirements are not being rewritten by this change.

## Impact

- Affected implementation: BIS integration/core contract services, Arkade wallet integration, state/recovery storage, prototype-sandbox Conditional Vault demo, generated contract-source presentation, and network capability diagnostics.
- Affected tests: contract unit/property tests, SDK/provider integration tests, failure/reconciliation tests, prototype-sandbox tests, and live acceptance scripts for both networks.
- Affected dependencies: the pinned Arkade SDK/provider capabilities may need to be upgraded only if the currently supported public API cannot express or submit the required stateful covenant.
- Affected operations: registered Signet and MutinyNet test wallets must be funded and available for controlled acceptance runs; no recovery phrases or signed material may be logged or committed.
- Scope boundary: no browser-local simulation may satisfy a contract requirement. A failed endpoint probe blocks funding through that configuration, not independent development. Both networks remain required for completion; implementation includes a tested infrastructure resolution path rather than treating unavailable UI as delivery.
- State encoding: build four immutable states backwards from the creator-only terminal claim. Each increment commits to the next output's script and preserves the 1000-sat principal. Exact opcode semantics and service compatibility must pass executable contract tests before funding.
- Operational dependency: a maintained Signet co-signer may be necessary. Its reproducible configuration, protected stable key, restart/recovery procedure, and browser connectivity are part of the solution if required. A remote service deployment still needs an actual hosting target and access; neither is assumed available from this plan.
- Planning precedence: this change owns the Conditional Vault replacement and its acceptance criteria. Earlier escrow and replacement changes are historical context for overlapping work, not additional implementations to apply in parallel. Existing treasure contract behavior stays outside this change.
