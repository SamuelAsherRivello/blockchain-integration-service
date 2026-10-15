# Design

## Context

See [proposal.md](proposal.md) for motivation. The F2 component already subscribes to the Game Wallet controller, whose public ready state includes `addresses.arkadeAddress`. The shared `CopyableValueField` and clipboard hook are already used for player-facing Arkade addresses. The F2 component currently uses local `busy` state for create, restore, and selection, while only logout registers with the shared pending-operation layer.

The implementation must remain compatible with the active `add-user-facing-game-wallet` change. It should extend the resulting F2 surface rather than reintroduce Admin-only balance, boarding, or recovery capabilities.

## Goals / Non-Goals

**Goals:**

- Render the selected public Arkade address using the existing reusable copy-field presentation.
- Register every F2 login mutation with the shared pending-operation layer and keep the page covered through controller readiness.
- Preserve safe terminal-error behavior, prior selection stability, and existing Back/logout navigation.
- Keep public UI data limited to the address already exposed by the controller's non-secret state.

**Non-Goals:**

- Adding Game Wallet balance, transaction, boarding, funding, or Admin details to F2.
- Changing address derivation, storage, account roles, recovery handling, or logout semantics.
- Adding a new clipboard dependency or a separate loading component.

## Decisions

### 1. Use the existing public address field and shared copy composition

When the controller reports a selected wallet with a ready address read, F2 will pass `state.addresses.arkadeAddress` to `CopyableValueField` with the existing `Arkade address` label. This keeps formatting, accessibility, clipboard failure handling, and success feedback consistent with Account Addresses.

Alternative considered: add a custom text row and button inside GameWalletLogin. Rejected because it would duplicate copy behavior and risk different labels or clipboard feedback.

### 2. Register login operations at the F2 boundary

Create, restore/import, and commit/select will each register a pending notice before awaiting the controller operation. The notice will use the established login wording (`Logging in...`) and remain active until the operation has returned and the subscribed controller state is ready or the operation has produced its safe error. Existing local `busy` state remains for button disabling and duplicate-action guards; it is not the user-facing loading indicator.

Alternative considered: infer loading solely from `state.status === 'loading'`. Rejected because local create/import/selection work can be in progress before the controller publishes a final state, and the UI must cover the complete user-triggered operation.

### 3. Preserve stale-address and error isolation

The address field will render only from the current selected-wallet snapshot and only in the selected F2 state. A failed or superseded operation will not copy or display an address from the previous selection as the new login result. Controller subscription cleanup and existing abort/selection guards remain authoritative for late results.

Alternative considered: retain the last address while a new login is pending. Rejected because it could make the user believe the previous wallet is the newly selected wallet.

## Risks / Trade-offs

- [The controller may finish its mutation before its address read is ready] → Keep the pending notice active until the subscribed ready state is observed; show the selected page only after the controller's public readiness boundary.
- [The shared pending layer may already contain another notice] → Use its existing registration/aggregation behavior so one current prompt covers the page without introducing a second overlay.
- [Long Arkade addresses can stress the compact 9:16 layout] → Reuse the existing copy-field wrapping/selection styles and verify at the supported narrow preview size.
- [Existing active-change planning currently excludes an end-user address] → Treat this proposal as a follow-up contract and apply it only after the active F2 implementation is available; do not silently edit that change's artifacts.
