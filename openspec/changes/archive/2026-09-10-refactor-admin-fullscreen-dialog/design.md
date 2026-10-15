## Context

See proposal.md for motivation. `MintAssetDialog` currently owns both the native `<dialog>` lifecycle and every mint-specific control, with all styling in `admin/assets.css`. Its header uses a left back arrow plus an empty right spacer, its status paragraph precedes the primary action, and its content order starts with Destination before Quick fill and the asset summary. A reusable Admin dialog is needed without moving demo-only composition into the public integration package.

## Goals / Non-Goals

**Goals:**

- Separate the modal shell and lifecycle from Mint Asset state and wallet operations.
- Express the exact viewport margins in one reusable Admin-owned style contract.
- Make Mint Asset sections and feedback order explicit while reusing current controls and state transitions.
- Retain native modal semantics, focus behavior, cancellation guards, and internal overflow.

**Non-Goals:**

- Moving Admin UI into `@bis/integration` or changing its public API.
- Changing mint validation, destination semantics, presets, wallet issuance, recovery, or Admin Console logging.
- Adding the second dialog consumer now.
- Introducing a UI dependency or redesigning controls beyond the requested composition.

## Decisions

1. Add `AdminDialogFullscreen.tsx` beside the other demo Admin components. It will own the dialog ref, `showModal`/`close` lifecycle, title association, cancel handling, focus restoration, header, and close button. It will accept a title, `onClose`, a close-disabled flag, workflow content, and an optional workflow class name. Keeping it in `integration-demo/src/admin` preserves the existing package boundary; putting it in the public integration package would expose demo composition prematurely.

2. Give the shared shell a dedicated `admin-dialog-fullscreen` CSS contract with viewport-relative dimensions equivalent to `inset-block: 10%` and `inset-inline: 25%`: 50% viewport width and 80% dynamic viewport height, with border-box sizing and internal vertical scrolling. Do not retain the old 720px width cap or narrow-screen margin override because either would violate the requested percentages. Workflow-specific Mint styles remain separately scoped.

3. Keep the native `<dialog>` element rather than replace it with a custom overlay. Native modality already supplies focus containment and Escape/cancel events. The shared component prevents cancellation while `closeDisabled` is true and disables the upper-right `X`; it restores the previously focused connected element during cleanup, matching existing behavior.

4. Keep the semantic HTML `<form>` owned by `MintAssetDialog`. Within it, render the existing presets first under Quick fill, then the existing summary under a Preview heading, then destination/help/recovery and existing inputs under a Form heading. Use the existing two-column field grid for a compact first row containing Destination and Control Asset at equal widths; Name and Ticker retain their matching two-column row. This changes composition only; all current state, handlers, disabled rules, and recovery behavior remain in `MintAssetDialog`.

5. Put a Clear button before the achievement presets. Build both initial state and Clear state from one default-draft factory so metadata returns to `an asset`, `ASSET`, `1`, `0`, and blank Icon URL with a fresh operation ID. Clear operates like the other Quick fill actions and does not change Destination.

6. Give the Preview summary card a fixed width and height, and when `form.iconUrl` is non-empty render it as a bounded fixed-size preview image in the avatar slot before the summary text. Use the controlled form value directly so preset selection, editing, and clearing update immediately without changing the card footprint. Provide the asset name as alternative text and preserve the same-size avatar fallback when the URL is blank; a load failure must not affect form validity or submission.

7. Render the current `mint-message` calculation in a visible workflow console region after the Mint/Done button. Use an output/status semantic and pre-wrapped, safely rendered text styling so guidance, validation, progress, and returned errors have a single stable location. The persistent Admin Console outside the dialog remains responsible for operation-level logs from App orchestration.

8. Update focused static-markup and browser fixtures to assert the shared shell, exact section order, Clear behavior, `X` control, absence of the back arrow, action-before-console order, equal-width Destination/Control Asset row, conditional icon preview, close guards, focus restoration, and viewport dimensions. Retain the existing mint destination and operation tests to prove the refactor does not change behavior.

## Risks / Trade-offs

- [A 50% viewport width can become narrow on small screens] → Honor the exact percentage contract, keep fields shrink-safe, and rely on internal scrolling; browser checks will cover the repository's narrow fixture.
- [Moving lifecycle code can regress focus or allow closing during submission] → Centralize the existing native-dialog lifecycle unchanged and add focused close/cancel/focus tests.
- [Reordering destination below Preview initially shows the default Game-wallet preview before selection] → Preserve the existing Game default and live preview updates; the Preview describes draft metadata, not ownership.
- [“Console” could be confused with the persistent Admin Console] → Name and style the in-dialog region as workflow console output while retaining the existing persistent operation log behavior.
- [A remote icon can fail to load] → Keep the text/avatar summary visible and do not couple image loading to form validity or mint submission.

## Migration Plan

No data, dependency, or API migration is required. Introduce the shared shell, migrate Mint Asset to it, update scoped styles and tests, then run focused tests, type checking, build, and browser verification. If a corrective rollback is required, use additive edits that restore the Mint-specific wrapper while leaving wallet records and operation IDs untouched.
