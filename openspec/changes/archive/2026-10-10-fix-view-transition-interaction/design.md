# Design

## Context

See `proposal.md` for the motivation and observable behavior. The shared transition wrapper uses a full-size `.bis-view-transition` container with `pointer-events: none` so only the mounted view content participates in host-layer input. Its active and outgoing surfaces are full-size descendants, but the active surface currently does not re-enable pointer events. The existing `.bis-button` and a few specialized controls compensate locally; ordinary form controls do not.

## Goals / Non-Goals

**Goals:**

- Establish one shared interaction boundary that makes the active transitioned view's mounted content pointer-interactive.
- Preserve the existing click-through behavior outside the active card or layer.
- Keep outgoing surfaces non-interactive and preserve their `inert`/aria-hidden lifecycle.
- Add focused regression checks for both the shared CSS contract and the Restore Account browser flow.

**Non-Goals:**

- Changing the view-transition animation, timing, reduced-motion policy, focus management, or navigation state machine.
- Adding per-control or per-page pointer-event overrides.
- Changing wallet, persistence, recovery, or public API behavior.

## Decisions

1. **Restore interaction at the active surface's direct content boundary.**

   Add a shared style for the direct child content of an active transition surface, excluding the exit surface. This lets pointer-event behavior inherit through the card/layer to inputs, textareas, checkboxes, and custom controls without making the full viewport-sized surface consume clicks outside the view.

   The alternative of setting `pointer-events: auto` on the entire surface would make the full-size transition surface intercept backdrop and host clicks, changing the overlay's event boundary. The alternative of adding rules to each input or view would duplicate the defect-prone workaround already visible in specialized controls.

2. **Keep exit behavior explicit.**

   The existing exit class remains `pointer-events: none`, and the active-content selector excludes it. This ensures rapid navigation cannot route input to stale content while its animation is finishing.

3. **Verify at the shared and user-flow levels.**

   Extend the existing view-transition contract test to assert the active-content interaction rule. Extend the browser-oriented Restore Account verification to focus and edit a recovery field and exercise its controls, proving the universal boundary fixes the reported page rather than only matching CSS text.

## Risks / Trade-offs

- [Risk] A future transition branch may render multiple direct children rather than one content root, leaving some content outside the interaction rule. → Mitigation: cover all current `ViewTransition` composition branches and keep the selector applied to every active direct child; revisit the boundary if a new branch violates the contract.
- [Risk] A nested component may intentionally disable pointer events for visual-only content. → Mitigation: the rule only establishes an interactive ancestor; descendants can still intentionally opt out, while the existing visual overlays retain `pointer-events: none`.
- [Risk] Browser verification may be unavailable in a restricted environment. → Mitigation: retain the shared source contract test and run the strongest available browser or host verification; report any unavailable runtime check explicitly.
