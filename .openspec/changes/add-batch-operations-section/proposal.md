## Why

The Admin demo has Marketplace batch actions, but no dedicated, visible place to begin a new local batch workspace or clear the most recently recorded one. A small numbered section makes that administrative state explicit without misrepresenting a UI reset as a wallet or Arkade operation.

## What Changes

- Add a new Admin section titled exactly `04. Batch Operations`.
- Add native, keyboard-operable controls titled exactly `Clear Last Batch` and `Start New Batch`.
- Give the controls a local, inspectable batch-session state: starting creates a new local batch record and clearing removes only that recorded local batch state.
- Report truthful local state changes to the existing Admin Console. These controls do not mint, burn, transfer, settle, cancel, or erase any remote wallet, Arkade, or Marketplace operation.
- Disable conflicting batch-session actions while their local transition is being committed, preserve the Admin panel's existing narrow-layout and folding behavior, and retain unrelated Admin controls.

## Capabilities

### New Capabilities

- `admin-batch-operations`: A local-only Admin batch-session section with safe start and clear controls, explicit state, and Console feedback.

### Modified Capabilities

None.

## Impact

- Affects Admin composition in `BIS/packages/integration-demo/src/admin/` and the Console feed in `BIS/packages/integration-demo/src/App.tsx`.
- Adds focused React/browser-host coverage for the new section's labels, enablement, keyboard operation, state transitions, and console reporting.
- Adds no Arkade SDK call, wallet mutation, persistence of secrets, dependency, server, or Marketplace asset-operation change.
