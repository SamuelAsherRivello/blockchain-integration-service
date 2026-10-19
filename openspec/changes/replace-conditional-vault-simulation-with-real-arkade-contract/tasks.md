# Tasks

## 1. Contract and network foundation

- [x] 1.1 Inspect the installed Arkade SDK/compiler contract APIs and identify the repository's existing test-wallet and network-selection helpers; verify the chosen APIs compile for the supported Signet and MutinyNet profiles.
- [x] 1.2 Implement the Conditional Vault contract source and generated-artifact pipeline with creator ownership, 100-sat funding, progress state, valid Increment transitions, and terminal Claim; verify deterministic construction and artifact generation in focused tests.
- [x] 1.3 Add network-scoped contract identity and sanitized persistence/lookup so vault IDs cannot collide across network or wallet identity; verify duplicate Create rejection and HD-state isolation tests.

## 2. Real wallet operations

- [ ] 2.1 Replace local Create simulation with real Arkade contract funding from the selected network's existing test wallet; verify the returned contract output and funding evidence are network-backed.
- [ ] 2.2 Implement real Increment spends that recreate the next contract state and reject invalid, terminal, missing, or unresolved states; verify repeated-call and failure-path tests.
- [ ] 2.3 Implement public Check using operator/wallet evidence without a mnemonic or fund movement; verify unknown, pending, expired, claimed, and completed status responses.
- [ ] 2.4 Implement real Claim spends that return the eligible contract value to the creator and reconcile terminal state; verify insufficient-funds, duplicate-claim, and successful refund paths.
- [ ] 2.5 Route every operation through the title-bar network selector and existing Signet/MutinyNet test-wallet profiles; verify network mismatch rejection and separate live configuration tests.

## 3. Demo presentation and truthful diagnostics

- [x] 3.1 Update the Conditional Vault Create page to show Demo and Smart Contract tabs with readable builder source, generated script/disassembly, and compiled artifact labels; verify the artifact shown is the one used by the operation.
- [x] 3.2 Keep Increment, Check, and Claim pages on Demo source only and update outputs to report demo name, results, then final success with real contract evidence; verify repeated calls return clear fallbacks.
- [x] 3.3 Remove remaining escrow/local-state/pseudocode claims from Conditional Vault labels, source, and errors; verify no UI path presents simulated success or raw secrets.
- [ ] 3.4 Add or update focused UI and integration tests for editable/read-only inputs, selected network, public Check, duplicate IDs, pending states, and terminal Claim; verify the Prototype Sandbox build and test suite.

## 4. Live acceptance and documentation

- [ ] 4.1 Run the complete Create → Increment → Check → Claim flow against the existing funded Signet test wallet and record only sanitized public evidence; verify all four operations use the selected network.
- [ ] 4.2 Run the complete flow against the existing funded MutinyNet test wallet and record only sanitized public evidence; verify network-specific operator and wallet state are used.
- [x] 4.3 Add truthful user-facing documentation for Arkade contract source, generated script, compiled artifact, virtual/off-chain execution, and any settlement limitations; verify documentation links and terminology.
- [ ] 4.4 Run the repository build, focused tests, and OpenSpec validation; mark the change complete only when deterministic checks pass and live acceptance is either verified on both networks or explicitly blocked by a documented operator/environment failure.

