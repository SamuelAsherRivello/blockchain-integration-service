# Design

## Context

See `proposal.md` for motivation. The shared React UI currently renders copy controls through `CopyButton`/`IconButton`, while title refresh controls are icon-only `IconButton` instances in the main account client and shared collection list/detail frame. Native buttons are naturally sequentially focusable unless their tab index is overridden.

## Goals / Non-Goals

**Goals:**

- Apply one consistent tab-order policy to all shared copy controls and title-adjacent refresh controls.
- Preserve pointer activation, accessible labels, disabled/loading behavior, clipboard feedback, refresh behavior, and visual styling.
- Verify that intended content and workflow controls remain in the sequential order.

**Non-Goals:**

- Do not remove controls from the accessibility tree or change their labels.
- Do not change clipboard contents, refresh timing, data loading, focus restoration, or public APIs.
- Do not make paste, seed visibility, tooltip targets, inputs, list rows, navigation actions, scroll regions, or the split-pane handle non-tabable.

## Decisions

- Use the native `tabIndex={-1}` mechanism on the targeted controls. This preserves click and programmatic activation while removing them from sequential Tab traversal.
- Expose the policy at the shared copy-control primitive for copy actions, rather than duplicating attributes at every copyable field call site. For title refreshes, apply the same policy at the shared icon-button usage or a narrowly scoped refresh prop/class so unrelated icon buttons such as Paste and Visibility remain tabable.
- Test both rendered attributes and keyboard traversal. Static assertions alone could miss a call site that bypasses the shared primitive; browser checks should cover representative Balance, Assets, Transactions, Receive, and Game Wallet views.
- Keep the refresh operation itself unchanged. A refresh control that is disabled during loading remains disabled; only its sequential focus participation changes.

## Risks / Trade-offs

- [Risk] A user who relies exclusively on keyboard Tab cannot invoke copy or refresh after this change. → Mitigation: preserve pointer and programmatic activation, keep accessible names and existing controls intact, and explicitly retain the primary content/navigation controls in the tab order. This is the requested utility-control policy and should be revisited only through a separate accessibility decision.
- [Risk] A future copy or title-refresh call site could bypass the shared policy. → Mitigation: add regression checks against shared rendered attributes and enumerate representative surfaces in the browser acceptance coverage.
- [Risk] `tabIndex=-1` can be mistaken for making a control inaccessible. → Mitigation: document and test that the controls remain visible, labeled, operable by pointer, and present in the accessibility tree.
