## 1. Shared network boundary and audit baseline

- [ ] 1.1 Inventory every production `SIGNET_OPERATOR`, `requireSignet`, fixed `bis-signet-*` key, and default provider construction; classify each as route, validation, persistence, observer, or presentation behavior and verify the inventory is represented by focused tests.
- [ ] 1.2 Add a shared verified account-network provider factory and scope-key helpers; verify Signet and Mutinynet route construction, exact operator mismatch rejection, and no fallback through focused unit tests.
- [ ] 1.3 Preserve a narrowly defined legacy-Signet compatibility read path while preventing Mutinynet access to untagged records; verify storage/journal/lock isolation with same-profile cross-network fixtures.

## 2. Account and asset operation routing

- [ ] 2.1 Migrate boarding, withdrawal, send, funding, and reservation-recovery adapters to the active account network, including network-specific address validation and explorer routes; verify Mutinynet uses no Signet provider and wrong-network evidence cannot submit or reconcile.
- [ ] 2.2 Complete network propagation across asset mint/list/burn/delivery/reconciliation/live observation paths and their operation journals; verify the C1 regression, cross-network stale completion, and network-specific user-facing validation text.
- [ ] 2.3 Update Player context operation guards to retain network generation through read, quote, submit, and recovery callbacks; verify a network switch suppresses delayed prior-network publication and durable writes.

## 3. Admin Game Wallet and contract routing

- [ ] 3.1 Change Game Wallet event observation and Admin diagnostics to receive the selected network/account context rather than an address-only Signet default; verify observer disposal and fresh Mutinynet reads with controller tests.
- [ ] 3.2 Migrate LTO provider creation, contract scope, recovery, locks, filters, attempt markers, and cleanup from Signet constants to the shared Player/Game network; verify Signet and Mutinynet contract records cannot block, resume, or settle each other.
- [ ] 3.3 Guard Marketplace and LTO actions against changed Player/Game network pairing as well as identity changes; verify no stale callback can use a prior-network signer.

## 4. Network-accurate presentation and documentation

- [ ] 4.1 Replace fixed Signet account/admin headers, error messages, funding confirmations, and asset-delivery wording with registry-derived selected-network text; verify UI and browser-host tests for both supported networks and no Mainnet option.
- [ ] 4.2 Update README/runbook statements to distinguish supported Signet/Mutinynet behavior from intentionally unavailable services; verify documentation tests and links without adding automated funding or secret handling.

## 5. End-to-end verification

- [ ] 5.1 Run the focused adapter, storage, context, Game Wallet, LTO, and browser-host regressions for both networks; verify test fixtures contain no recovery material and record unavailable external dependencies truthfully.
- [ ] 5.2 Run `npm run typecheck`, the relevant full test suites, `npm run build`, and `git diff --check`; investigate or explicitly separate unrelated existing failures before declaring the audit complete.
- [ ] 5.3 Perform non-mutating browser diagnostics for Signet and Mutinynet, confirming the visible Admin/Account network context and selected routes; do not create an on-network asset, payment, or funding request as part of smoke verification.
