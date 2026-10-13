# Proposal

## Why

The Send and Account Transfer screens place several unrelated text fields between the shared amount control and their actions. This makes the amount-to-action path unstable and, when a transfer is pending with a zero amount, presents two competing messages in the same area.

## What Changes

- Add one standalone, replaceable status line below the sats amount control in Send and Account Transfer; it is not part of the shared control.
- Use `Set amount above` as the default status and replace it with applicable input, availability, transfer-state, or recovery guidance without ever rendering two status fields.
- Add fixed page body text: `Send balance to another address.` on Send and `Swap between your balances.` on Account Transfer.
- Reserve error prompts for failures returned after the user starts review or confirmation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `account-address-sending`: constrain Send's amount-entry presentation and relocate its non-amount feedback.
- `account-boarding-settlement`: constrain Account Transfer's amount-entry presentation while preserving pending-operation visibility and recovery actions.

## Impact

- `BIS/packages/integration/src/client/ui-layer-react/AccountSend.tsx`
- `BIS/packages/integration/src/client/ui-layer-react/AccountTransfer.tsx`
- Relevant browser/component tests and overlay styles, if needed for the shared status line.
