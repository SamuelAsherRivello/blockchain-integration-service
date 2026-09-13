## 1. Test-network foundation

- [ ] 1.1 Add the internal Signet/Mutinynet registry, validated non-secret browser preference, and session-generation coordinator; verify unit tests reject invalid/mainnet preferences and require selection on first use.
- [ ] 1.2 Replace the Signet-only account/provider setup with a selected-network factory that verifies public operator and SDK-reported network identity before use; verify focused tests cover Signet success, Mutinynet success, unavailable info, and exact-network mismatch failure.
- [ ] 1.3 Confirm the installed Arkade SDK can create the required Mutinynet provider/wallet configuration without a Signet fallback; verify a real non-funding Mutinynet operator/SDK info diagnostic and record a truthful unavailable result if support is absent.
- [ ] 1.4 Namespace encrypted Player/Game Wallet stores, envelopes/AAD, channels, selection records, journals, and caches by network, including safe recognition of legacy Signet data only; verify a record from one network is rejected before decryption or presentation on the other.

## 2. Network-aware wallet and diagnostic workflows

- [ ] 2.1 Thread the immutable verified network/session context through Player Wallet create, restore, identity/address derivation, account activation, and profile reconciliation; verify delayed create/restore work cannot commit after network change.
- [ ] 2.2 Thread the same context through Game Wallet create, restore/import, selection, reload, and role coordination; verify Player and Game Wallet remain distinct identities on one network and reject cross-network activation in either ordering.
- [ ] 2.3 Route balance, activity, addresses, assets/minting, onboarding, sending, payment, and contract/LTO adapters through the selected verified routes; verify unit coverage proves no cross-network result is accepted as healthy.
- [ ] 2.4 Scope recipient validation, send review, asset presentation, onboarding records, and contract evidence to the current session generation; verify a network change invalidates a prepared send and prevents stale provider callbacks from publishing.

## 3. Paired logout and network-switch safety

- [ ] 3.1 Add a private paired lifecycle coordinator that freezes Player/Game Wallet work, stops subscriptions, and verifies Game Wallet logout before Player Wallet logout succeeds; verify cleanup failure produces retryable failure without successful-disconnection events.
- [ ] 3.2 Make confirmed Player Wallet logout log out the active same-network Game Wallet while preserving remote funds/submitted operations and existing Player backup/pending acknowledgements; verify core logout and Game Wallet tests cover success, offline cleanup, pending work, and repeated submission.
- [ ] 3.3 Implement deliberate network switching using the same coordinator: clear active encrypted selections and in-memory diagnostics before persisting the new preference, then require fresh login; verify cross-tab and late-callback tests show no prior-network state after switching or reload.

## 4. Clear network-specific UI and funding guidance

- [ ] 4.1 Add the first-use Signet/Mutinynet selector to Player Account and Game Wallet entry paths, and replace fixed Signet headers/warnings with the selected network label; verify browser-host checks show no diagnostic starts before selection and no mainnet option.
- [ ] 4.2 Update Account restore/create, Game Wallet recovery, Admin F1/F2/F3, balance/activity/assets/contracts, and send review surfaces to keep one selected-network context visible; verify narrow 9:16, keyboard, and role/network-rejection coverage.
- [ ] 4.3 Render selected-network onboarding guidance from the registry, including Mutinynet's copyable user-run `mutinynet-cli onchain <boarding-address> [sats]` command, GitHub device-login explanation, and live manual faucet fallback; verify the command uses the current address and BIS neither invokes the CLI nor stores a token.

## 5. Documentation and end-to-end verification

- [ ] 5.1 Update the integration and demo README/runbook material to describe the browser-only Signet/Mutinynet diagnostic offering, exact endpoint health checks, paired logout/switch behavior, user-run Mutinynet funding options, and explicit no-mainnet boundary; verify documentation tests and link checks pass.
- [ ] 5.2 Run focused integration/controller/storage/UI/browser-host tests for selector routing, operator mismatch, cross-wallet cohesion, encrypted isolation, paired logout, switching, and Mutinynet funding guidance; verify no recovery material appears in state, logs, screenshots, or output artifacts.
- [ ] 5.3 Run the full relevant test suite, TypeScript/build checks, and `git diff --check`; verify a local browser flow for Signet regression plus a separate real Mutinynet diagnostic/login/read path, recording any unavailable external service rather than fabricating success.
