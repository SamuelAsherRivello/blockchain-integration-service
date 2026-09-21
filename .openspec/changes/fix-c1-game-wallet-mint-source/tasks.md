# Tasks

## 1. Source and destination contract

- [ ] 1.1 Add source/destination-aware public mint request, result, and safe error types while preserving the Arkade-free game-facing boundary; verify TypeScript package type checks and existing non-C1 callers remain compilable.
- [ ] 1.2 Add durable C1 operation records for source profile, destination profile, issuance phase, delivery phase, transaction evidence, and operation IDs; verify malformed or incomplete records cannot authorize a replay.

## 2. Game Wallet issuance and delivery

- [ ] 2.1 Route every C1 issuance through the active Game Wallet and retain the existing eligible-unreserved-funds and mutation-lock checks; verify focused asset tests prove Player Wallet is never used as the issuer or funding source.
- [ ] 2.2 Compose Game Wallet issuance with optional Game-to-Player exact-quantity delivery using the existing asset-delivery boundary; verify Game-to-Game skips delivery and Game-to-Player reports success only after destination ownership evidence.
- [ ] 2.3 Implement phase-aware pending, retry, unknown-result, and reconciliation behavior for issuance and delivery; verify interrupted issuance and interrupted delivery tests do not duplicate either phase or reuse reserved inputs.

## 3. Admin C1 UI

- [ ] 3.1 Add a visible fixed Source dropdown/value set to Game wallet and retain an independent Destination dropdown for Player wallet or Game wallet; verify the browser-host test shows the source cannot be changed and destination selection remains editable.
- [ ] 3.2 Update C1 preparation, validation, console logging, pending recovery, and wallet-change invalidation to track source and destination separately; verify missing Player Wallet blocks only Player-destination submission and does not charge Game Wallet.
- [ ] 3.3 Update C1 styling and layout for the source/destination controls without regressing the existing Quick fill, Preview, Form, and console order; verify the focused UI/layout checks pass.

## 4. Regression and documentation

- [ ] 4.1 Update unit and integration tests for Game-to-Game, Game-to-Player, insufficient Game Wallet funds, missing Player destination, recovery, and duplicate prevention; verify the relevant package test commands pass.
- [ ] 4.2 Update C1 user-story documentation, design discussion references, and generated/checked documentation assertions to describe fixed Game Wallet sourcing and selectable destination; verify documentation tests and OpenSpec validation pass.
- [ ] 4.3 Run the focused production build and browser verification against the Admin C1 flow, recording only public transaction/result evidence under the repository output convention; verify no recovery material or private signer data appears in output.
