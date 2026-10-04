## Context

See proposal.md for motivation and the onboarding delta specification for the behavior contract. `AccountOnboarding` currently turns `OnboardingView` and its optional durable record into five always-open disclosure cards, includes a per-second countdown state, and renders a timing/recovery disclosure. The integration-demo onboarding host is the focused browser-facing regression fixture.

## Goals / Non-Goals

**Goals:**

- Derive one ordered display state for each of the five existing stages from the already-available onboarding view and record.
- Keep the closed summary stable, compact, and vertically aligned at the narrow account-card width.
- Preserve accessible native disclosure behavior and the existing opened-stage controls/content.

**Non-Goals:**

- Altering onboarding assessment, confirmation, signing, scheduling, recovery, reservations, or completion persistence.
- Changing the containing Account card, including its existing outer Back control.
- Adding a new component library, animation, dependency, or public API.

## Decisions

### 1. Derive stage display state locally from durable facts

`AccountOnboarding` will derive a five-item status sequence instead of extending `OnboardingView`. A completed parent yields five Complete states. Otherwise, an observed incoming transaction completes stage 2, a durable plan completes stage 3, and a verified return receipt completes stage 4; the first remaining stage is Pending and all later stages are Unstarted.

This keeps the display mapping adjacent to its renderer and avoids changing the core financial-service contract for presentation-only state. It also handles an already-ready completion as an all-complete sequence.

Alternative considered: publish a current step from the onboarding service. Rejected because it duplicates facts already in the durable record and risks coupling scheduling/recovery transitions to visual state.

### 2. Keep native details but remove their default open state

Each stage remains a native `details` element, but the `open` attribute is removed. Summary content is always one grid row: fixed disclosure affordance, non-wrapping step/owner, flexible title, and status at the right edge. The disclosure body retains the existing funding, transaction, and transfer material for users who choose to inspect it.

Native disclosure preserves keyboard and assistive-technology semantics without a custom interaction state. A separate closed-only layout was rejected because switching geometry on toggle would create layout instability and duplicate markup.

### 3. Use explicit visual-status classes

The summary receives one of `complete`, `pending`, or `unstarted` modifier classes. CSS applies a restrained green, yellow, or grey background and matching readable text, while the shared grid uses `align-items: center` to avoid the mockup's vertical drift. The summary title is allowed to take remaining width; metadata and status remain aligned rather than participating in the former two-row grid.

Alternative considered: infer the color from the status text. Rejected because semantic classes keep state and styling independently testable and avoid brittle text selectors.

### 4. Remove presentation-only observation state

The component will remove its per-second timer, elapsed formatter, live status/countdown paragraph, and timing/recovery details subtree. Background onboarding continues to publish and use the same observation and recovery data; it is simply no longer rendered by this screen. The static instruction becomes the only introductory paragraph.

Alternative considered: retain the live detail in a collapsed diagnostics disclosure. Rejected because it directly conflicts with the requested removal and returns visual weight to the default flow.

## Risks / Trade-offs

- [The concise static instruction can hide a transient diagnostic] -> durable automatic behavior remains unchanged, and opened existing stage details continue to show factual transaction/transfer state.
- [A long stage title can compress narrow summaries] -> use a flexible title column with a fixed metadata/status footprint and verify the 340px account-card fixture.
- [A phase transition can briefly precede parent completion] -> treat a verified return receipt as stage 4 complete and stage 5 pending until the durable parent completes.

## Migration Plan

1. Add failing focused UI-host assertions for five closed one-line summaries, state colors/statuses, exact introductory text, and the absence of the old diagnostics.
2. Refactor the component and stylesheet to implement the local display mapping and compact summaries.
3. Run the focused host and package validation, then visually inspect the narrow browser fixture.
4. Roll back by reverting only the component, stylesheet, host assertions, and this change's planning artifacts; no persisted data or public contract migration is involved.
