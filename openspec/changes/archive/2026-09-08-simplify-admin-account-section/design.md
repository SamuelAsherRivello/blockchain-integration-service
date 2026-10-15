## Context

See proposal.md for motivation and scope. AdminPanel.tsx currently renders nine Account shortcuts from a static array; App.tsx delegates selection to selectAccountStory. Existing story-driven-demo requirements explicitly require several shortcuts, so their navigation wording must change together. The checkout contains substantial unrelated work that must be preserved.

## Goals / Non-Goals

**Goals:** Keep the existing StoryAction interaction and selection contract while separating the Account story summary from its two entry controls.

**Non-Goals:** No production navigation redesign, wallet changes, new APIs, dependencies, changes to other Admin controls, or claims about new Signet capabilities.

## Decisions

- Keep A1 and A4 identifiers and existing callbacks; change only the A4 display label to Account Dialog. Replacing their handlers would needlessly change production behavior.
- Render a static A-series summary independently of the reduced button array. Deriving it from visible buttons would incorrectly omit A2, A3, A5, and A6. The summary denotes implemented stories, while documentation retains pending live checks; it is not a release certification.
- Render the heading, summary, and buttons in normal document flow, with modest summary-specific spacing and wrapping. Do not reproduce the screenshot annotation's oversized overlapping text or change global section typography.
- Remove only redundant Admin entry controls; keep production navigation and legacy selection support. Update only affected Account navigation references in current demo documentation, preserving story titles, IDs, and evidence status.

## Risks / Trade-offs

- Summary could imply all live checks passed → preserve documented pending checks and avoid adding completion badges.
- Shared CSS could alter other sections → scope any additional spacing to story summaries.
- Navigation specifications and docs currently name removed buttons → update affected entry references to Account Dialog and subsequent production navigation.
- Existing unrelated edits could be overwritten → make narrow edits against the current checkout and review the scoped diff.

## Migration Plan

No data migration. Apply the Admin-only changes and related navigation references, run typecheck/build, and verify in a browser at wide and narrow Admin widths. Verify both entry points and remaining production navigation with isolated fixtures where account state is needed; do not submit transactions or clear real account data. If necessary, undo only this change through a new additive edit.


## Approved scope extension

The apply request adds summaries to every other lettered Admin story section. Use B1, B2; C1, C4, C6; D1, D2; E1, E2; F1, F2, F3 based on implemented documented stories. Place F's summary in GameWalletPanel.tsx. Preserve existing controls.

