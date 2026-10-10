# Tasks

## 1. Shared transition primitive and styling

- [x] 1.1 Add a reusable UI-layer transition boundary that tracks a stable logical view key, retains one outgoing surface through exit completion, and prevents stale transition callbacks from winning; verify with focused component tests covering enter, exit, interruption, and outgoing-surface interaction state.
- [x] 1.2 Add centrally declared BIS transition custom properties, enter/exit keyframes, lifecycle classes, and reduced-motion behavior in `overlay.css`; verify the stylesheet and UI tests use the configured 100ms duration, 0.8 scale origin, and opacity endpoints without per-view animation values.

## 2. Integrate supported BIS surfaces

- [x] 2.1 Route the normal AccountCard composition and the Assets/Contracts/Transactions collection branch through the shared transition boundary, including nested Asset Detail, Contract Detail, and Transaction Detail keys; verify navigation and Back tests preserve existing destinations and focus behavior.
- [x] 2.2 Apply the same transition boundary to Restore Account, recovery, logout confirmation, Onboarding, Send, Receive, Swap, Developer, Game Wallet Login, Account chooser/menu, and the Pending Operation dialog; verify each supported surface enters and exits while inline loading, errors, dropdowns, toggles, and toasts do not replay the full transition.
- [x] 2.3 Handle rapid navigation and reduced-motion preferences across the integrated surfaces; verify browser tests show the latest destination remains interactive and no stale outgoing view intercepts pointer or keyboard input.

## 3. Integrated verification

- [x] 3.1 Run the integration package typecheck/build and relevant UI/browser tests; verify the production integration bundle succeeds and the view-transition acceptance coverage passes.
- [x] 3.2 Inspect the Admin portrait preview and document any verified transition behavior or limitations in the change evidence; verify the existing Admin and Marketplace application behavior remains unaffected by the shared integration stylesheet export.
