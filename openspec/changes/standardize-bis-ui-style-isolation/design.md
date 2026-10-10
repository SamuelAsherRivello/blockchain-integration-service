# Design

## Context

The production BIS UI is rendered by `@bis/integration` and is consumed by the Admin demo, Marketplace, and external game hosts. The shared stylesheet already scopes most rules under `.bis-*`, but some visual properties remain inherited and Marketplace currently contains selectors that reach into BIS internals, including `.detail .marketplace-detail-field .bis-copy-field-heading { font: inherit; }`. The screenshot-confirmed result is different casing, letter spacing, and weight for the same Accounts Details labels.

## Goals / Non-Goals

**Goals:**

- Make BIS-owned visual properties deterministic at the production UI boundary.
- Allow hosts to position and size BIS without re-theming its internal views.
- Remove current host-to-BIS style coupling, especially in Marketplace.
- Verify equivalent BIS views across Admin, Marketplace, and a game-host representation.

**Non-Goals:**

- Redesigning the BIS visual language.
- Making the surrounding Admin, Marketplace, or game page shells look identical.
- Changing wallet behavior, view content, navigation, or public runtime APIs.
- Requiring the separate game repository to adopt a new framework or dependency.

## Decisions

### Use an explicit scoped BIS style island first

The implementation will establish the BIS root as the style boundary. The root and protected descendants will explicitly own the visual properties that must not be inherited: font family, font size, font weight, line height, letter spacing, text transform, color, text alignment, and relevant spacing/control properties. A scoped reset may be used where necessary, but it must restore accessibility, layout, focus, and interaction defaults intentionally.

This is preferred over immediately adopting Shadow DOM because the existing contract renders into a supplied host container and relies on overlays, focus behavior, and shared CSS loading. Shadow DOM remains a possible future hardening step if scoped isolation cannot satisfy the cross-context verification.

### Keep host responsibilities narrow and documented

Host CSS may control the outer mount region, closed launcher placement, visibility, stacking, and container sizing. Host styles must not select or override `.bis-*` descendants. Marketplace rules will be rewritten to target Marketplace-owned elements only; no BIS-specific exception will be retained merely to preserve its current divergent appearance.

### Verify computed style invariants across host fixtures

Use representative host fixtures already available in the repository to render the same BIS view in Admin-like, Marketplace-like, and game-like containers. Assertions will compare protected properties for representative headings, field labels, balance labels, action buttons, and Back/navigation controls. The verification will distinguish allowed responsive geometry changes from forbidden visual-token changes.

## Risks / Trade-offs

- [Risk] An overly broad reset can break focus rings, inherited sizing, or overlay interaction. -> [Mitigation] Apply the reset only within the BIS root, explicitly restore interaction and accessibility properties, and run existing UI-host tests.
- [Risk] Some consuming games may depend on undocumented host overrides. -> [Mitigation] Preserve the documented placement contract and identify any failing consumer fixture before implementation is considered complete.
- [Risk] Computed-style tests can become brittle across browser engines. -> [Mitigation] Assert the protected visual contract at stable semantic elements and use visual snapshots only for representative integration coverage.
- [Risk] Removing Marketplace overrides can expose hidden layout assumptions. -> [Mitigation] Run Marketplace loading, account, and dialog verification alongside the new style checks.
