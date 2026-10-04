## Context

The integration package already owns the production BIS overlay and exports its CSS through `@bis/integration/style.css`. A partial `FitTextButton` implementation is used only by the Send/Receive/Swap row, while most production actions remain ordinary `.bis-button` elements with local width and font overrides. `PendingOperations` already provides the host-local loading window, and `GameWalletLogin` is rendered inside that provider but currently owns logout busy state without registering a pending notice.

The Account screen also has two local UI flags: `developerOpen` and `gameWalletLogin`. Developer currently opens from the active Account menu, while Game Wallet Login returns by clearing only `gameWalletLogin`. Onboarding has a separate direct host entry path, so its Back destination must distinguish Developer-originated navigation from direct opening.

## Goals / Non-Goals

**Goals:**

- Establish one reusable label-fitting behavior for production `.bis-button` controls, including buttons whose width comes from grid or flex constraints.
- Make Game Wallet setup use the same compact two-action presentation as Account setup.
- Place Developer under Account Details and preserve clear Developer-subflow return navigation.
- Register Game Wallet logout with the existing pending-operation provider so the established modal, focus, inertness, and failure behavior are reused.
- Preserve direct host/Admin Onboarding routing and all existing wallet state, persistence, and recovery boundaries.

**Non-Goals:**

- No new UI framework, measurement dependency, wallet API, persistence field, or network behavior.
- No redesign of marketplace-only buttons or Admin shell controls that are not production `.bis-button` controls.
- No change to the meaning of logout acknowledgements, Game Wallet selection, Onboarding settlement, or recovery phrase handling.

## Decisions

### 1. Generalize the existing fit-text primitive at the BIS button boundary

Use the existing fit-text approach as the basis, but make the shared production button path responsible for wrapping/measuring its visible label. Measure the button's current content width after layout, compare it with the label's intrinsic single-line width, and apply a temporary reduced font size only when needed. Observe button size changes and font readiness so responsive preview changes restore the normal size. Keep padding, minimum hit-area dimensions, color variants, focus outlines, and disabled behavior in CSS.

Alternative considered: CSS-only `clamp()` or `text-overflow`. Rejected because CSS cannot reliably reduce a label based on its rendered text width, and ellipsis/clipping violates the complete-label requirement.

### 2. Reuse the existing two-column action container for Game Wallet

Render the unconfigured Game Wallet actions in the existing account-action grid rather than creating a second layout primitive. Keep each action at `width: 100%` with `min-width: 0`, let the shared fit behavior handle the labels, and leave Back in the surrounding vertical action flow. Rename only the user-facing setup labels; retain the internal component and controller terminology.

Alternative considered: allow the two Game Wallet buttons to remain stacked and only reduce their font. Rejected because the supplied reference explicitly requires both actions on one row.

### 3. Track Developer-originated Onboarding locally in the screen composition

Move the Developer trigger into the Account Details action sequence. When it opens Player Wallet Onboarding, retain a local return-origin marker or equivalent screen state while hiding the Developer panel during the subview. The shared outer Back handler will return to the Developer panel only for that origin; direct host/Admin Onboarding calls will continue to return to Account Details. Game Wallet Login already has the desired behavior because clearing its subview leaves Developer open.

Alternative considered: change the core context's `closeAccount()` destination globally. Rejected because the core context does not know whether Onboarding was opened by Developer or directly by a host, and changing it would break the existing direct-entry contract.

### 4. Register Game Wallet logout with `usePendingNotice`

Call the existing pending-notice hook from `GameWalletLogin` using its local `busy` state and the label `Logging out...`. The surrounding `PendingOperations` provider will then render the established loading window, inert the underlying runtime content, manage focus, and remove the window when the promise settles. Keep the component's local busy guard and disabled controls as the synchronous duplicate-submission protection.

Alternative considered: add a second loading overlay inside Game Wallet Login. Rejected because it would duplicate focus/inertness behavior and could stack with the existing account loading window.

### 5. Verify behavior with held asynchronous fixtures

Extend focused integration-demo fixtures to hold Game Wallet logout before resolving, then assert the pending dialog label, disabled controls, and post-resolution unconfigured state. Add assertions for Account Details action order, Developer return paths, direct Onboarding Back, Game Wallet labels/order, and reduced label font behavior at constrained widths. Browser verification will use the 100% reference scale and a narrow layout that exercises the fitting path.

## Risks / Trade-offs

- [A shared measurement wrapper can affect button DOM shape] -> Preserve button semantics and accessible text, keep the visible label in a normal descendant, and update selectors/tests that depend on the old direct text node only where necessary.
- [Font loading or ResizeObserver timing can produce a one-frame mismatch] -> Measure in a layout effect, reset before each measurement, observe size changes, and remeasure after document fonts finish loading.
- [Developer-origin state can become stale when the Account view closes] -> Clear the marker whenever the Account view leaves or the Developer flow is abandoned; test reopening Account and direct host entry separately.
- [A failed Game Wallet logout may leave the selected wallet unchanged] -> Reuse the controller's existing rejection behavior and assert that only the existing error path is shown; the loading window must not imply success.
