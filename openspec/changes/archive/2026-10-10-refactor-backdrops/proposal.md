# Proposal

## Why

BIS currently uses a lighter blurred backdrop for normal account surfaces but a separate, darker, unblurred backdrop for pending operations. The inconsistent treatment makes the loading state feel like a different overlay system and can compound visual dimming when it covers an already-open BIS surface.

## What Changes

- Define one shared BIS backdrop treatment with centrally controlled opacity and blur values.
- Apply that treatment to the normal BIS layer backdrop and the Pending Operation loading backdrop.
- Apply the same treatment to the native confirmation dialog backdrop so all BIS modal surfaces have a consistent surrounding veil.
- Keep foreground cards and dialogs visually distinct from their shared surrounding backdrop.
- Preserve backdrop coverage, z-order, focus management, loading semantics, and reduced-motion behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pending-operation-dialog`: require the pending-operation backdrop to use the shared BIS opacity and blur treatment rather than an independently darker, unblurred style.

## Impact

- Affected styling: `BIS/packages/integration/src/client/ui-layer-react/overlay.css`.
- Affected loading and confirmation overlay composition may include `PendingOperationDialog.tsx` and the native confirmation dialog styling.
- No public runtime API, wallet behavior, navigation behavior, or operation semantics should change.
