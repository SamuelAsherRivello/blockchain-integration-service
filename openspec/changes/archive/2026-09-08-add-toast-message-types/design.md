## Context

See proposal.md for motivation. `core/toasts.ts` accepts duration, imageUrl and an optional lightning icon but no severity. `ToastViewport.tsx` renders an image or lightning symbol beside text; CSS uses one neutral card. The queue already preserves order, independent hold duration and literal message text. Public options are exported from `src/index.ts`.

Producers are `payment-notifications.ts`, `game-continue.ts`, `asset-collection.ts`, demo `App.tsx`, and `CompletionPreview.tsx`. Dynamic continue failures can pass through SendError/BoardingBlockedError or persisted result messages. The prior F3 change is implemented in this checkout and must retain its verified-receipt behavior and balance-before-final-toast timing accepted by the user.

## Goals / Non-Goals

Goals: consistent semantic presentation and sentence-case built-in wording across all current producers. Non-goals: wallet changes, new toast triggers, queue/timing changes, dependencies, global string lowercasing or changing unrelated labels.

## Decisions

- Export a runtime `MessageType` object with `Info`, `Warning`, `Error`, `Success` members mapping to `info`, `warning`, `error`, `success`, plus its corresponding TypeScript union. Add optional `messageType` to BisToastOptions and a resolved type on every queue entry. Missing or invalid runtime values fall back to info. Existing calls remain valid.
- Preserve card dimensions, rounded corners, shadow, wrapping, slide motion and runtime containment. Use a pale blue background with circled i for info, pale amber with warning triangle for warning, pale red with barred circle for error, and pale green with check for success. Use small inline SVGs and CSS variables rather than platform emoji. Target text contrast >=4.5:1 and icon contrast >=3:1; tune exact colors during visual verification.
- Always show the semantic type icon. Preserve optional artwork as secondary content; replace the old standalone lightning treatment on built-in continue success with the success icon. Retain compatibility for the legacy icon option without allowing it to hide the type icon. No category word or category colon is rendered. Preserve ordinary punctuation inside messages.
- Classify pending/checking receipts and continue payments as info; verified receipts, completed own transfers, successful continue and trophy collection as success; logged-out/not-ready/missing-recipient conditions as warning; failed operations and dynamic failure messages as error. D1/D2 remain info demonstrations. Provide all-four-type coverage through a test fixture without adding new production Admin stories.
- Edit built-in templates at their producers. Examples: `User {ID} sent you {amount} sats (Pending)`, `User {ID} sent you {amount} sats (Confirmed)`, `Transferred {amount} sats from Bitcoin to Arkade`, `Level {level} trophy collected!`. Preserve Bitcoin, Arkade, BIS and exact IDs/URLs. Do not alter arbitrary external messages in the queue: automatic case conversion can corrupt identifiers. Dynamic application-owned error wording is reviewed at its source; existing stored text remains literal.
- Announce type and message through the existing polite live region without adding a visible prefix. Keep icon decoration hidden from assistive technology to avoid duplicate reading. Retain nonblocking behavior, reduced motion and pending-dialog coexistence.

## Risks / Trade-offs

- Type plus optional artwork reduces text space → verify long error messages and artwork at 9:16 preview sizes and scaling.
- Existing specs/tests assert title-case receipts and text-only fallback → update them coherently to sentence case and icon-plus-text fallback; receipt/settlement semantics stay intact.
- Generic dynamic error messages may contain proper names → make deliberate source edits and preserve literal host data instead of applying text transforms.

## Migration Plan

Add the compatible public option, classify producers, update rendering and tests, document the API and revise affected exact-message documentation/spec assertions. No persistence migration. Validate in an isolated browser fixture without payments; perform an additive correction if rollback is needed.

## Confirmed wording refinement

User requested capitalized status endings in parentheses across messages: (Pending), (Confirmed), and (Failed). Continue started, still processing and checking use `You sent {amount} sats (Pending)`; success uses `You sent {amount} sats (Confirmed)`; definitive failure uses `You could not send {amount} sats (Failed)`. This supersedes lowercase status endings above. No success is inferred for failed submissions.
