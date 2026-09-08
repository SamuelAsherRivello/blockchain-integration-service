## Context

The initial implementation opened a browser popup. The user corrected the requirement: View Recovery Info must open a new dialog within BIS, with no new browser window. AccountActivity owns selection and the selected public report; AccountCard supplies the shared BIS dialog layout.

## Goals / Non-Goals

**Goals:** In-BIS Recovery Info dialog, matching card and copy report styling, only Back as footer action, intact originating Transaction Detail selection.

**Non-Goals:** Wallet operations, SDK changes, public API changes, external browser windows, or changes to Explorer behavior.

## Decisions

- AccountActivity retains a selected report snapshot and trigger element when opening Recovery Info.
- RecoveryInfoDialog renders through a React portal into the nearest BIS layer, preserving the host's scale and bounds. Reuse AccountCard, CopyableTextArea and useClipboardCopy; no cloned styles or independent React root.
- Make the source card inert while the dialog is open. Focus the Recovery Info heading, contain Tab navigation within the dialog, and let Back or Escape dismiss it and restore trigger focus. Restore the prior inert state on unmount.
- Keep the original Transaction Detail state mounted. Closing AccountActivity unmounts the dialog as part of the same React lifecycle.
- Preserve the existing three detail actions and disabled states. Open On Explorer retains its external navigation behavior.

## Risks / Trade-offs

- Nested overlay rendering must stay within the BIS host and above the source card: use a scoped overlay stacking rule and test narrow host dimensions.
- Clipboard failure must retain selectable text and feedback without additional footer actions.

## Verification

Use the existing recovery browser script and both activity harnesses to verify no window.open call, report isolation, copy success/failure, Back, Escape, focus restoration, background inertness and compact sizing. Run the production build. No live wallet operations are required.
