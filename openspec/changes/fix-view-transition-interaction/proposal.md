# Proposal

## Why

The shared BIS view-transition wrapper currently makes portions of active views non-interactive: Restore Account fields and similar controls on multiple pages cannot receive pointer input, while controls that explicitly opt back into pointer events (such as Back) still work. This is a cross-view regression at the shared interaction boundary and should be corrected once so every transitioned view remains usable.

## What Changes

- Restore pointer interaction for the active content surface rendered by the shared `ViewTransition` component.
- Keep outgoing transition surfaces non-interactive while they animate out, so stale views cannot intercept input.
- Add regression coverage proving that active transitioned content is interactive and that the Restore Account flow exposes usable word fields and controls.
- Preserve existing transition timing, reduced-motion behavior, focus behavior, navigation semantics, and the surrounding host page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bis-view-transitions`: transitioned views must preserve pointer and keyboard interaction for their active content while outgoing surfaces remain inert.

## Impact

- `BIS/packages/integration/src/client/ui-layer-react/ViewTransition.tsx` and its shared overlay styles.
- Existing BIS UI views that render through `ViewTransition`, including Restore Account, Account Details, Send, Receive, Swap, Onboarding, recovery, and Game Wallet screens.
- View-transition and browser-level UI verification tests; no public API, persistence, wallet, or dependency changes.
