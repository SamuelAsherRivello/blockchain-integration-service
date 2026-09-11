## Why

The shared pending prompt already gives Marketplace loading a clear, centered presentation, but a terminal failure currently shifts to a different error layout and title. A failed trade should retain the same visual frame while making the actual error immediately readable.

## What Changes

- Add a reusable BIS error-prompt presentation to the shared pending-operation UI.
- Present terminal operation failures with the exact title `Error` and the safe error text as body copy.
- Remove the lightning bolt from the terminal error state while preserving the existing backdrop, dialog placement, focus handling, acknowledgement, and loading behavior.
- Consume the shared BIS error presentation in Marketplace rather than adding Marketplace-specific error markup or styles.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pending-operation-dialog`: Define the shared terminal error-prompt title, body-only content, and absence of the loading bolt for Marketplace and other consumers.

## Impact

- `BIS/packages/integration/src/ui/PendingOperationDialog.tsx` and its focused UI tests.
- Marketplace's existing shared prompt composition and focused prompt test, without new dependencies or wallet-operation changes.
