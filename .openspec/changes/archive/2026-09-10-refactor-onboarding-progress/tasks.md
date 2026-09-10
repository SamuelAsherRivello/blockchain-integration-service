## 1. Regression coverage

- [x] 1.1 Update the integration-demo onboarding UI host with initially failing assertions for five closed one-line summaries, the exact introductory text, one Pending stage, semantic stage classes, and the absence of countdown/timing/recovery presentation; verify the focused host reports the expected pre-implementation failure.

## 2. Compact onboarding presentation

- [x] 2.1 Refactor `AccountOnboarding` to derive the ordered Complete/Pending/Unstarted display states from the existing onboarding view and record, remove the live countdown/timing/recovery rendering, and preserve opened-stage content and the outer Back control; verify the focused host passes all updated assertions.
- [x] 2.2 Update onboarding stylesheet summary layout and status colors for a vertically aligned single-line closed row at the narrow account-card width; verify computed layout and state-class assertions in the focused host.

## 3. Delivery verification

- [x] 3.1 Run the focused onboarding UI host in a real browser and visually confirm the 340px account card has closed, single-line, vertically aligned summaries with the requested status colors; save any diagnostic screenshot under `output/screenshots/onboarding-progress/`.
- [x] 3.2 Run `npm run typecheck` and `npm run build` from the repository root, and run OpenSpec strict validation with the CLI-supported command form; verify all pass without modifying unrelated working-tree changes.
