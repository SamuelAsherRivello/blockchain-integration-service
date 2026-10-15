# Design

## Context

The normal BIS layer already has the desired player-facing backdrop treatment: a translucent dark color with a 2px blur. Pending operations currently use a separate darker translucent color without blur, while native confirmation dialogs use another color without blur. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**

- Establish one shared BIS backdrop configuration for opacity and blur.
- Apply it consistently to normal BIS layers, pending operation coverage, and native BIS confirmation dialog backdrops.
- Preserve overlay bounds, z-order, dialog contrast, pointer blocking, focus trapping, and loading behavior.

**Non-Goals:**

- Changing the foreground card or dialog appearance.
- Changing the view transition scale, opacity, or duration.
- Changing loading timing, operation semantics, or navigation behavior.
- Harmonizing unrelated Marketplace or Admin-only backdrops.

## Decisions

- **Use the existing normal BIS treatment as the shared visual baseline.** The effective player-facing rule is `rgb(20 35 48 / 42%)` with `blur(2px)`, so the pending and confirmation surfaces should adopt those values rather than introduce a new visual baseline.
- **Centralize values as BIS CSS custom properties.** Define the backdrop color and blur once in `overlay.css`, then consume the variables from `.bis-layer-open`, `.bis-pending-backdrop`, and `.bis-confirmation::backdrop`. This keeps future visual tuning to one location.
- **Keep separate structural selectors.** The three surfaces have different positioning and stacking responsibilities, so they should share values without being collapsed into one class or changing their DOM ownership.
- **Leave the foreground loading dialog independent.** Only the surrounding fullscreen veil is unified; the pending dialog retains its own solid surface, shadow, and view-transition behavior.

## Risks / Trade-offs

- [Risk] Applying blur to the pending backdrop may blur more of the underlying runtime than the current dark-only veil. → Mitigation: use the already-approved 2px normal BIS blur and verify the loading dialog remains legible in the Admin preview and runtime hosts.
- [Risk] A shared backdrop can make nested confirmation surfaces feel less visually separated. → Mitigation: preserve the dialog surface, shadow, and z-index boundaries; only the surrounding veil values are shared.
- [Risk] Browser support for `backdrop-filter` varies. → Mitigation: keep the translucent background as the functional fallback; blur remains progressive enhancement.

