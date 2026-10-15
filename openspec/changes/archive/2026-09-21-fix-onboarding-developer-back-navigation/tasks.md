# Tasks

## 1. Navigation implementation

- [x] 1.1 Update the production account UI's onboarding parent-route handling so Developer-origin onboarding exits onboarding and restores Developer deterministically; verify the rendered route is Developer after the first Back action.
- [x] 1.2 Preserve and verify the existing Balance-origin onboarding Back behavior, including the context flags for Account Details and onboarding; verify it does not open Developer.

## 2. Regression coverage

- [x] 2.1 Extend the onboarding UI harness to cover Developer → Onboarding → Back → Developer → Back → Account Details, including visible titles/actions and closed onboarding state.
- [x] 2.2 Run the focused onboarding host test and the relevant integration UI checks; verify the new route scenario passes without regressions in the existing onboarding and account navigation flows.
