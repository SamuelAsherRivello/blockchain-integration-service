## Why

Back currently blends into the other dialog action buttons. A three-dot separator above it will make navigation slightly easier to distinguish while preserving the compact layout.

## What Changes

- Add one subtle three-dot separator immediately above every visible dialog Back button.
- Apply consistent, small spacing and three faint dots across the production account dialogs, including nested detail and recovery views.
- Preserve button wording, dimensions, order, focus, disabled states, and navigation behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-entry`: Require consistent visual separation above dialog Back actions throughout production UI.

## Impact

Production UI in `BIS/packages/integration/src/ui/`: shared styles in `overlay.css` and Back rendering in `client.tsx`, `RestoreAccount.tsx`, `AccountSend.tsx`, `AccountTransfer.tsx`, `AccountActivity.tsx`, `AccountAssets.tsx`, and `recovery-window.ts`. No public API, dependencies, core, or wallet changes.

Assumption: Back means the labeled dialog action. The admin Mint Asset header arrow is labeled Close Mint Asset and is outside this footer change; the documentation Back to demo link is not a dialog action.
