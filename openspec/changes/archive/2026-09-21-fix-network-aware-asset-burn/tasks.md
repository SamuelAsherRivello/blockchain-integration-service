# Tasks

## 1. Reproduce and isolate network routing

- [x] 1.1 Add a deterministic Mutinynet burn fixture that records Arkade/indexer provider URLs and currently fails or routes to Signet; verify the pre-fix fixture demonstrates the mismatch without using a live wallet or secret.
- [x] 1.2 Add mismatch and legacy-record fixtures covering provider network disagreement, existing Signet journal recognition, and same operation IDs across networks; verify zero submission and isolated recovery/reservation behavior.

## 2. Implement network-aware burn state

- [x] 2.1 Pass the active account network into burn provider and temporary-wallet construction, and verify fresh holding, spendable-input, and SDK submission calls all use the selected operator in the Mutinynet adapter test.
- [x] 2.2 Make new burn journal/reservation and mutation-coordination keys network/operator scoped while preserving read-only compatibility with legacy Signet records; verify cross-network records cannot release or reserve active-network inputs.
- [x] 2.3 Preserve exact holding/input validation, durable pre-submit intent, other-asset preservation, and unknown-outcome protections while mapping network/provider failures to safe typed results; verify no pre-submit mismatch submits and no post-submit failure retries.
- [x] 2.4 Route every Player Wallet adapter (balance, addresses, funding, sends, transfers, contracts, asset delivery/mint/burn, and recovery/reconciliation) from the active account network; verify Signet and Mutinynet provider fixtures for each transaction family and reject reported network mismatches before submission.
- [x] 2.5 Enforce the Player Account/Game Wallet network invariant at selection, refresh, live observation, balance/address reads, payments, transfers, and mutations; verify a mismatched saved Game Wallet cannot be read or used.

## 3. Verify user flows

- [x] 3.1 Extend Account Assets browser-host coverage for Mutinynet confirmation, one pending/confirmed burn request, same-network holdings refresh, safe mismatch acknowledgement, and duplicate-click protection; verify the supplied address is never persisted or logged.
- [x] 3.2 Extend Admin H2 batch coverage for network-scoped disjointness and partial results; verify an unresolved burn is not retried and other proven-disjoint same-network items continue safely.

## 4. Final validation and handoff

- [x] 4.1 Run focused integration/demo burn tests and verify the Mutinynet routing, mismatch, legacy compatibility, and UI assertions pass.
- [x] 4.2 Run `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check`, and `openspec validate --change fix-network-aware-asset-burn --strict`; verify all commands complete successfully.
- [x] 4.3 Run the actual local Admin flow at `http://127.0.0.1:5174/blockchain-integration-service/admin/` with a disposable test asset only if independently available; otherwise record live burn as unperformed and do not claim it passed. Live burn remains intentionally unperformed because no disposable asset was independently available.
