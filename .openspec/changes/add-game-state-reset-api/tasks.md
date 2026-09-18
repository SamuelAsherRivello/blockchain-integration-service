## 1. Public contract and reset orchestration

- [x] 1.1 Add provider-neutral `BisGameResetResult`/error types and export `resetForGame()` from `BisGameServices`; verified by repository typecheck/build without Arkade types on the public method.
- [x] 1.2 Add a serialized force-reset coordinator at the core lifecycle boundary, distinct from interactive player logout; verified concurrent reset calls execute one cleanup sequence.
- [x] 1.3 Coordinate player local account cleanup, game-wallet logout/deselection, BIS journals, generation records, transient controllers, subscriptions, UI state, and same-origin notifications; verified player/account state and contract recovery cleanup in the focused reset path.
- [x] 1.4 Add generation/token guards so late callbacks cannot save, publish, reopen UI, or reactivate pre-reset state; verified by the focused live-context reset test.
- [x] 1.5 Preserve truthful handling of submitted/uncertain network operations and return non-secret completion/failure results; verified result shape contains only `status` and `resetId`, with documentation covering non-cancellation.

## 2. Verification

- [x] 2.1 Add focused new-behavior tests for force cleanup, no-acknowledgement reset, repeated calls, and active-context clearing; `node --test BIS/packages/integration/tests/game-state-reset.test.mjs` passes 3/3. Broader regression coverage was explicitly skipped per user instruction.
- [x] 2.2 Add a focused live-context test proving reset invalidates another context without changing unrelated host storage; the new reset test passes with the host sentinel retained. Broader cross-context regression coverage was explicitly skipped per user instruction.
- [x] 2.3 Verify the public API/type surface through repository typecheck and production build; no Arkade-specific type is exposed by `BisGameServices.resetForGame()`.

## 3. Game and demo integration

- [ ] 3.1 Add a Clear All Settings action to the game/demo host that clears host-owned gameplay preferences and awaits `resetForGame()` with no confirmation dialog; verify no confirmation UI appears.
- [ ] 3.2 Ensure reset completion returns to a playable guest state and reset failure is reported without claiming success; verify the guest play path remains available in the browser fixture.
- [ ] 3.3 Add integration/browser smoke coverage for the full Clear All Settings path, including player wallet, game wallet, BIS UI/session state, and retained remote-operation truthfulness; verify the smoke script passes on the game origin.
- [x] 3.4 Update the public package README with the reset contract, scope, and warning that network operations are not canceled; verified `BisGameServices.resetForGame()` and its limits are documented.

## 4. Validation

- [x] 4.1 Run the focused new reset behavior test; verified 3/3 pass. Existing regression suites were intentionally not run per user instruction.
- [x] 4.2 Run typecheck/build; verified `npm run typecheck` and the full production build pass. Existing BIS-to-game smoke checks were intentionally not run.
- [x] 4.3 Verify no recovery phrase, wallet secret, transaction payload, or unrelated browser storage is emitted by reset results or diagnostics; verified provider-neutral result shape and host-storage sentinel preservation in the focused test.
