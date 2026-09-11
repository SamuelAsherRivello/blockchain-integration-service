## Why

The account UI currently exposes the saved-profile chooser, letting people see, add, and switch profiles in the Account dialog. The multi-profile persistence and selection capability must remain available, but it should not be presented or named anywhere in the user interface.

## What Changes

- Remove the visible Profiles entry point, Saved Profiles view, profile list, active-profile marker, and Add Profile controls from the shared production Account UI.
- Ensure an Account dialog with no active account still presents the ordinary Create Account and Restore Account entry paths, even when other saved identities exist locally.
- Preserve encrypted origin-local multi-profile storage, profile-scoped wallet/equipment/operation isolation, creation/restoration behavior, and programmatic selection APIs; this change does not delete, merge, or migrate stored identities.
- Remove profile-management wording from the production Account UI while retaining the existing Account ID field in Accounts Details as its separately scoped identity display.
- Update logout routing so logout may leave other locally saved identities intact without exposing a profile-selection UI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-entry`: Remove the saved-profile chooser presentation while retaining standard logged-out Account entry and the existing non-profile account routes.
- `account-creation`: Retain multi-profile persistence after creation without requiring the Account UI to list or select saved profiles.
- `account-restoration`: Retain multi-profile persistence and duplicate-safe restoration without requiring the Account UI to list or select saved profiles.
- `account-logout`: Preserve other saved identities after logout without directing the user to select a profile through the UI.

## Impact

- Affected code: shared React account UI, its profile-chooser component/styles, and focused UI/core regression tests in `BIS/packages/integration`.
- Affected behavior: Account entry and post-logout presentation only; storage format, public context APIs, Arkade integration, wallet operations, and dependencies remain unchanged.
