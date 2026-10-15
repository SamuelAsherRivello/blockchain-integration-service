# Design

## Context

See `proposal.md` for the motivation and user-facing scope. The production BIS UI is rendered from `BIS/packages/integration/src/client/ui-layer-react/client.tsx`. `BisScreen` currently selects views through conditional rendering, with collection views taking an early return and nested detail views controlled by local state. `overlay.css` already owns shared BIS presentation rules and reduced-motion rules for smaller animations.

## Goals / Non-Goals

**Goals:**

- Add one reusable transition boundary for the main BIS view composition and the separate collection-view branch.
- Keep the requested 100ms, 80%-to-100% scale and 0%-to-100% opacity behavior centrally configurable.
- Retain outgoing DOM long enough to show exit motion, while making only the current view interactive.
- Preserve current focus restoration and Back behavior.
- Cover the Pending Operation dialog without turning toasts or inline state changes into full-screen transitions.

**Non-Goals:**

- Changing state-layer navigation, wallet operations, persistence, or public integration APIs.
- Adding an animation dependency or changing the existing visual design of cards and controls.
- Animating arbitrary child content, loading placeholders, dropdown menus, or toast playback.

## Decisions

### 1. Use a small local transition boundary

Add a focused React transition wrapper in the UI layer rather than introducing a third-party animation library. The wrapper receives a stable view key and renders the current child plus an outgoing child while the exit timer or animation-end signal completes. This is required because the current conditional JSX unmounts the previous view immediately, which cannot produce an exit animation.

Alternative considered: CSS-only classes on the existing conditional elements. Rejected because CSS cannot animate an element after React has removed it.

### 2. Use shared CSS custom properties and keyframes

Declare the duration, initial scale, final scale, and timing curves in the shared BIS stylesheet. Enter and exit keyframes consume those values. The React wrapper owns lifecycle classes and animation completion; CSS owns the visual values so the motion can be tuned without editing every view.

Alternative considered: inline animation styles per component. Rejected because values would drift across screens and make tuning expensive.

### 3. Define stable logical view keys

Derive keys from the visible surface, including nested detail identity such as Assets versus Asset Detail and Transactions versus Transaction Detail. State changes within the same logical view do not remount or replay the full transition. The collection branch and the normal AccountCard branch use the same transition boundary so their behavior stays consistent.

### 4. Keep only the active surface interactive

During a cross-fade or exit, the outgoing surface receives non-interactive presentation state while the incoming surface owns focus and pointer interaction. When a transition is interrupted, stale animation state is discarded and the latest view wins. Existing focus effects remain the source of focus targets after navigation settles.

### 5. Handle reduced motion at the shared boundary

The shared reduced-motion rule disables or minimizes the keyframes and allows the wrapper to settle immediately. This applies equally to navigable screens and the Pending Operation dialog and does not change semantic visibility or focus behavior.

## Risks / Trade-offs

- [Risk] Keeping two views mounted briefly may allow duplicate IDs or competing focus targets. -> Scope the wrapper to one active and one outgoing surface, mark the outgoing surface inert/non-interactive, and verify focus behavior in browser tests.
- [Risk] A 100ms transition may be interrupted by rapid navigation. -> Use a stable key, cancel stale completion handlers, and immediately promote the latest requested surface.
- [Risk] The collection early-return path could bypass a shared wrapper. -> Refactor the composition boundary so both collection and card branches pass through the same transition mechanism.
- [Risk] Transforming a scaled card can alter perceived shadow or overflow during the brief animation. -> Animate the existing view container rather than changing card dimensions or layout rules, then visually verify the portrait preview.

## Migration Plan

No data or API migration is required. Add the wrapper and shared styles, update UI tests, run the package typecheck/build and relevant browser tests, and remove the feature by reverting the wrapper and styles if a rollback is needed.

## Open Questions

None. The supported-surface scope and exclusions were decided during exploration.
