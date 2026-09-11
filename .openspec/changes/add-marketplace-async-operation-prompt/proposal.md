## Why

Marketplace buy and sell work can begin while the page remains interactive, leaving no clear, consistent signal that a wallet operation is in progress. The shared BIS Pending Operation Dialog already provides the approved centered loading presentation, but the Marketplace does not use it for its foreground checkout work.

## What Changes

- Present Marketplace initial preparation and every foreground user-triggered async operation, including Buy, Sell, and explicit checkout reconciliation, with the shared BIS Pending Operation Dialog: centered over a dark translucent backdrop, with an operation label above the existing spinning bolt.
- Keep the Marketplace covered and non-interactive from operation start through required wallet/inventory refresh and final rendering; preserve accessible focus handling and reduced-motion behavior from the shared BIS component.
- On confirmed completion, reveal the refreshed Marketplace state. On a failed or unconfirmed foreground operation, use the shared dialog's safe terminal presentation while retaining the durable item-scoped checkout record and recovery path.
- Preserve nonblocking catalog browsing and disjoint safe actions once a durable checkout has reached its separately represented pending/recovery state; the new prompt is not a settlement-length overlay.
- Export or otherwise compose the shared pending presentation through the public integration UI boundary rather than duplicating its markup, styles, or animation in Marketplace.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marketplace-trading`: Define blocking shared-BIS presentation for active Buy, Sell, and reconciliation work while retaining item-scoped recovery after an unresolved outcome.
- `pending-operation-dialog`: Extend the shared dialog contract to Marketplace preparation and foreground operations without duplicating its visual or accessibility behavior.

## Impact

- Affects `@bis/integration` public UI composition/exports and the existing Pending Operation Dialog.
- Affects Marketplace checkout busy/error state, Buy/Sell controls, stacking over the mounted Account UI, focused tests, and browser verification.
- Does not change checkout sequencing, wallet authority, catalog visibility, transaction semantics, or add dependencies.
