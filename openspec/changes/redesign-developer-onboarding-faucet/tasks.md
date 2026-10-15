# Tasks

## 1. Onboarding runbook surface

- [x] 1.1 Recompose the onboarding shell/header and balance summary into a compact developer runbook header while preserving existing IDs and state bindings; verify the onboarding smoke tests still initialize and render all six stages.
- [x] 1.2 Add chronological stage-summary affordances and foldouts around secondary evidence, timing, and diagnostics without changing operation logic; verify all six stage labels and controls remain in order in the browser accessibility snapshot.
- [x] 1.3 Refine onboarding CSS for the shared developer tokens, compact spacing, status states, responsive one-column layout, and keyboard focus; verify no horizontal overflow at desktop and mobile widths.
- [x] 1.4 Add the minimal title/network top bar and confirmed scoped reset behavior; verify cancel preserves the current run and confirm reloads with the selected network.

## 2. Faucet runbook surface

- [x] 2.1 Reorder the Faucet presentation into environment/health/request/result sections while preserving existing form fields, IDs, API calls, and status rendering; verify faucet core and route smoke tests pass.
- [x] 2.2 Move secondary addresses, balances, history, and operation identifiers into descriptive native foldouts while keeping current status and next action visible; verify public evidence remains readable when expanded.
- [x] 2.3 Refine faucet CSS to match the onboarding/Admin developer surface and responsive behavior; verify the request form remains usable at desktop and mobile widths without horizontal scrolling.
- [x] 2.4 Move network selection into the minimal top bar and confirm/reset form state on change; verify the selected network refetches health and addresses after confirmation.

## 3. Verification and handoff

- [x] 3.1 Run the focused onboarding and faucet test suites plus the shared route smoke test and record results under `output/reports/redesign-developer-onboarding-faucet/`.
- [x] 3.2 Inspect Admin, Marketplace, Onboarding, and Faucet together and confirm only the two requested standalone routes changed; document any Admin backport opportunities in the change handoff.
