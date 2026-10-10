# Proposal

## Why

The logout confirmation currently treats safety warnings as prerequisites for cleanup, and several storage or wallet conditions can reject the final action. That leaves users unable to leave an account even when they accept the consequences. Logout should always be an available user action while still making the most important consequences visible.

## What Changes

- Keep the Account Log Out confirmation, but shorten its lead text to: `Backup your recovery phrase before logging out.`
- Show only applicable acknowledgement checkboxes for backup, unresolved operations, and separate Game Wallet state; treat every checkbox as informational acknowledgement rather than a submit gate.
- Keep the final Log Out action available regardless of whether warnings are unchecked, pending-operation counts change, Game Wallet reset is unavailable, or a warning cannot be refreshed.
- Make Player logout clear the selected Player profile and its local journals without cancelling submitted network operations, claiming completion, or deleting other profiles.
- Remove pending-operation snapshot and Game Wallet reset failures as reasons to abort Player logout; keep the separate Game Wallet independent and communicate its retained state when applicable.
- Preserve truthful progress, failure reporting, cache/session invalidation, cross-context reconciliation, and Admin Reset guards.
- Update logout specifications, documentation, and focused tests for zero through three applicable warnings and unconditional logout availability.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `account-logout`: change warning acknowledgements from destructive-action gates to non-blocking risk disclosures and guarantee that Player logout remains available.

## Impact

- React logout confirmation in `BIS/packages/integration/src/client/ui-layer-react/client.tsx`.
- Logout orchestration and public state in `BIS/packages/integration/src/client/state-layer-core/context.ts`.
- Player storage cleanup and browser mutation coordination in `BIS/packages/integration/src/client/state-layer-core/account-storage.ts` and `logout-cleanup.ts`.
- Logout tests and the account/logout documentation. No new dependency or network API is required.
