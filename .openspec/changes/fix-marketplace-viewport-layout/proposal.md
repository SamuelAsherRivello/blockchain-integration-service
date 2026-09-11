## Why

At the supplied 100% browser scale, the Marketplace’s desktop override scales the whole Account overlay layer. This misplaces the Account launcher and causes the open modal and backdrop to occupy only part of the viewport.

## What Changes

- Establish a stable Marketplace desktop sizing contract instead of transforming the runtime overlay layer.
- Anchor the Marketplace Account launcher in a deliberate lower-left desktop position.
- Ensure an open Account flow uses an unscaled, full-viewport backdrop with its dialog centered in that viewport.
- Preserve the existing public catalog, wallet behavior, and responsive small-screen presentation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marketplace-catalog`: Define the Marketplace desktop viewport and Account-launcher presentation.
- `account-entry`: Allow a host-defined entry placement without changing the Account dialog’s full-host modal behavior.

## Impact

- `BIS/packages/marketplace/src/account-launcher.css`
- `BIS/packages/marketplace/src/square-grid.css`
- Marketplace browser visual and interaction checks; no API or dependency changes.
