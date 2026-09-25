## Why

The onboarding dialog currently expands all five stages, mixes its stage labels across two lines, and exposes live timing and recovery detail that obscures the simple user action: fund step 2, then wait. The progress display needs a compact, legible state model that makes the current step obvious without weakening automatic onboarding or recovery behavior.

## What Changes

- Render the five onboarding stages closed by default, with a single, vertically aligned summary row containing the disclosure affordance, step/owner, title, and status.
- Color the completed prefix green, exactly one current stage yellow, and all later stages grey.
- Replace the changing introductory and countdown text with: "You must fund the account per step 2. Otherwise sit back and wait for completion."
- Remove the timing and recovery disclosure and all rendered content after step 5.
- Add focused regression coverage for the compact closed presentation, stage-state progression, and removed timing/countdown UI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-automatic-onboarding`: Define the compact five-stage onboarding presentation, its single-pending visual progression, and the removal of timing/recovery display details.

## Impact

- Affected UI: `BIS/packages/integration/src/ui/AccountOnboarding.tsx` and `onboarding.css`.
- Affected verification: the integration-demo onboarding UI host and focused UI assertions.
- No public API, dependencies, account funding, automatic settlement, or recovery behavior changes.
