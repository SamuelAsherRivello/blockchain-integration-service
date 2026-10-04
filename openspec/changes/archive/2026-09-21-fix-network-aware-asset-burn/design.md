# Design

## Context

See proposal.md. Asset listing, minting, and the account's selected-network state already use `TestNetwork`, while several older transaction adapters still call Signet-only providers. The burn adapter also constructs its provider without the account network and stores records under a Signet-only prefix. The current mutation lock and exact-input journal must remain authoritative.

## Goals / Non-Goals

**Goals:**

- Make the network selected by the active account the single source for burn provider construction and verification.
- Make the same network invariant apply to every Player Wallet transaction and any selected Game Wallet.
- Keep operation IDs, input reservations, logout warnings, and unknown-outcome protection isolated by account/network/operator scope.
- Preserve compatibility with existing Signet records and keep all public errors sanitized.
- Prove the fix with deterministic adapter tests and the real Account Assets host flow.

**Non-Goals:**

- No live burn using the supplied address or any user-provided credential.
- No automatic retry after the SDK submission boundary, reconciliation redesign, or change to H2's safety rules.
- No change to game-facing API types or the separate game repository.

## Decisions

1. **Pass `account.network` explicitly into the burn provider factory.** Listing already demonstrates the intended routing contract. The burn path will use the same account network for Arkade provider, indexer, wallet construction, fresh holdings, and submission. This is preferred over changing the provider default, because a default cannot know the active account and could silently route a selected Mutinynet account to Signet.

2. **Route every adapter from the account, not global Signet constants.** Balance, addresses, funding, sends, transfers, contract operations, asset delivery/mint/burn, and recovery reads will derive the operator from `account.network`. Defaults remain Signet only for legacy accounts that have no saved network; a selected network is never silently downgraded.

3. **Make burn journal and reservation keys network-aware while reading legacy Signet keys.** New records will include the active network/operator scope. Existing Signet records remain readable and protected during migration; they are not copied into Mutinynet or treated as cross-network success. This avoids losing recovery state while preventing operation-ID collisions across networks.

4. **Validate the provider's reported network before the submission boundary.** The existing provider wrapper already checks operator identity for reads. Every adapter will preserve that check and map a mismatch to a safe, specific failure. A mismatch cannot be repaired by retrying the same operation, because doing so could select unrelated inputs.

5. **Bind Game Wallet selection to the Player Account network.** The existing network-scoped Game Wallet storage remains authoritative. Selection, refresh, balance/address reads, live events, and mutations will all reject a wallet whose saved network differs from the active Player Account.

6. **Keep context error mapping typed and conservative.** Known `BurnError` categories remain visible to the UI; unexpected provider failures remain sanitized. The change will not infer success from a missing holding or a provider error after submission.

7. **Test at the adapter seam and browser host.** Signet and Mutinynet fixtures will assert provider URLs for each affected transaction family; mismatch fixtures will assert zero submissions. The Account Assets and Game Wallet hosts will verify same-network selection and no duplicate request. Live evidence remains optional and must use a disposable test asset supplied outside chat.

## Risks / Trade-offs

- [Risk] Existing Signet journal keys may not contain an explicit network field. → Treat the legacy prefix as Signet-only and retain its current validation/recovery behavior.
- [Risk] A browser can retain stale selected-network state while an account changes. → Re-read the active account and verify provider network immediately before intent and submission.
- [Risk] A provider can accept a transaction and then fail while acknowledging it. → Preserve the existing pending record and unknown-outcome rule; never retry automatically.
- [Risk] Existing tests and cleanup code may hard-code the Signet prefix. → Update fixtures and cleanup recognition together, then run focused tests, typecheck, build, and strict OpenSpec validation.
