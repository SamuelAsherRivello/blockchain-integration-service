# Design

## Context

See `proposal.md` for the motivation. The account UI currently renders a shared `.bis-layer` backdrop around a card, while several collection components own list/detail state and their own Back callbacks. Pending operations render a higher-priority, non-dismissible covering layer. The implementation must preserve those existing boundaries.

## Goals / Non-Goals

**Goals:**

- Establish one shared back-dismissal contract with an explicit per-view boolean.
- Route Escape and outside-card pointer activation through the same callback used by the visible Back action.
- Keep nested collection detail/list transitions local and preserve current busy guards and focus restoration.
- Make the interaction testable without coupling it to wallet or Arkade state.

**Non-Goals:**

- Changing the navigation destinations or removing visible Back buttons.
- Making loading, error, pending, account-entry, or other non-back surfaces dismissible by default.
- Adding browser-history integration, a new navigation stack, or a game-facing API.

## Decisions

### Use “back dismissal” as the capability name

The capability describes the user-visible result rather than a specific input device. A local boolean such as `backDismissalEnabled` (or the repository’s established equivalent) is declared alongside each view’s existing Back handler. A centralized presentation boundary consumes it and the handler.

An implicit “if a Back button exists” DOM query was rejected because it would make disabled, hidden, nested, and busy Back controls difficult to reason about. A per-view declaration makes the contract auditable and matches the requested manual review of every view.

### Handle both inputs at the shared backdrop boundary

The shared account layer handles Escape and checks that a pointer target is outside the card before calling the supplied Back handler. Card content stops propagation or is excluded by containment, so ordinary controls remain unchanged. The handler is guarded by the same busy/closing conditions as the visible Back action.

Adding document-global listeners was rejected because it could dismiss a covered or unrelated surface and would complicate ownership when pending dialogs or native confirmation dialogs are active.

### Pass local Back behavior through nested views

Collection components retain ownership of their list/detail state and expose the currently valid Back callback to the shared surface. This ensures dismissal from Asset Detail, Contract Detail, or Transaction Detail returns to the corresponding list before the broader account flow closes.

### Keep pending operation presentation authoritative

The pending-operation backdrop remains above the runtime surface and non-dismissible. It must intercept Escape and pointer input as it does today; the underlying view’s enabled flag must not bypass that coverage.

## Risks / Trade-offs

- [Escape conflicts with native/browser behavior] → Prevent default and stop propagation only when the active BIS surface owns back dismissal; leave disabled surfaces untouched.
- [Backdrop click may fire after a drag or pointer sequence] → Use the existing backdrop event strategy and require the final target to be outside the card; add browser coverage for card controls and outside clicks.
- [Busy navigation can receive duplicate input] → Reuse the current disabled/closing guard and test repeated Escape/click events during transitions.
- [Manual view inventory can drift] → Add a test or review checklist covering every shared view and explicitly assert false for loading/error/pending surfaces.

## Migration Plan

1. Add the capability contract and tests while keeping all views disabled by default.
2. Review each production view and enable it only where the current Back/cancel destination is valid.
3. Run the relevant integration tests, typecheck, and build.
4. Rollback is a code revert; no persisted data, wallet state, or public API migration is required.
