## Why

Every BIS form already identifies the Signet network but does not identify the running BIS version. A subtle version label will make the loaded integration release visible without moving the centered network label.

## What Changes

- Preserve the existing Network: Signet label and its horizontal center on every form that displays it.
- Add very faded text immediately to its right, formatted `BIS: v<version>` using the running integration package version, not a hardcoded placeholder.
- Keep the shared header behavior consistent in the demo and other consuming hosts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-entry`: Shared production form headers identify the running BIS version beside the centered network label.

## Impact

The shared AccountCard and overlay CSS in BIS/packages/integration, package version metadata, and relevant demo layout verification are affected. No dependency, public API, wallet behavior, or release version bump is needed. The package currently reports 0.14.0, so the current display would be `BIS: v0.14.0`. No unresolved product decisions; exact fade and spacing are implementation details to verify visually.
