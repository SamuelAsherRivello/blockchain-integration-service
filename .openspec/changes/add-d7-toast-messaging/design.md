## Context

See proposal.md for motivation. `BisContext` already provides state subscriptions and account lifecycle events but has no notification API. `BisView` is the shared root for `createBisUi` and `GameOverlay`; its account screen returns null when the account view is empty. `PendingOperations` owns `.bis-runtime`, viewport sizing, and an inert content wrapper plus a sibling operation backdrop. The toast must not be conditional on the account view or placed inside that inert wrapper.

The demo creates its context and UI in `App.start()` and mounts them inside the scaled 9:16 `GamePreview` container. `AdminPanel` currently has A/B/C categories and some D stories placed under Account. Node tests use `node:test`; browser fixtures live under the demo's `tests/` directory. No SDK capability is involved in displaying notifications.

## Goals / Non-Goals

**Goals:** Provide a reusable context-local notification path and a single shared renderer, preserve host input/focus, and make ordered delivery deterministic enough to test without wallet access.

**Non-Goals:** Notification history, cross-tab delivery, persistent messages, action buttons, severity variants, payment-result subscriptions, conversion of existing inline clipboard indicators, and changes to the external game repository. Existing confirmation and acknowledgment-required error dialogs retain their behavior. D1 does not add automatic success messages to Burn or other existing operations.

## Decisions

### 1. Public entry point with context-local ownership

API: `context.showToast(message: string, options?: BisToastOptions): void`, with `BisToastOptions` exposing optional `durationMs` and `imageUrl`. Export the options type from the integration entry point. Core producers and the demo use this same path; no Arkade types or React values cross the boundary.

Keep normalized entries and their FIFO queue in a focused core notification module owned by each context. Internal controls expose subscription, current entry, completion, and presentation lifecycle hooks to the UI; do not overload account lifecycle events with timer ticks. A document-global bus would mix independent hosts, while a demo-only state hook would fail to provide BIS-wide messaging.

Proposed input defaults: ignore blank text; render accepted text literally; use 3000 ms when duration is omitted, non-finite, non-positive, or above the browser timer range. Accept finite positive durations within that range. Assign a unique entry ID so equal strings are separate notifications. The method follows the context's existing disposed-call guard. Notifications are memory-only and callers supply safe user-facing text, never copied recovery material or raw wallet error payloads.

### 2. One presentation lifecycle per entry

Use `idle -> entering -> visible -> exiting -> next entry`. Proposed motion is 200 ms for entry and 200 ms for exit; the configured hold starts only after entry completes. The next message enters only after the previous exit completes. This implements the confirmed FIFO choice and avoids interrupting messages or filling the narrow viewport with a stack.

Use explicit phase scheduling with cancellation and an entry/generation guard, rather than depending solely on CSS transition events that can disappear on unmount or reduced motion. Reduced motion removes both slide intervals while retaining the configured hold and ordering. Identical notifications must still advance and announce separately.

Queue submissions before first UI mount without starting their lifetime. On a real UI unmount, clear the current message and backlog and cancel scheduling; messages explicitly submitted afterward can wait for the next mount. Context disposal clears all notification state. Account navigation alone does not clear notifications. React StrictMode effect replay must not drop, duplicate, or prematurely complete a message. No persisted or previous-session replay is supported.

### 3. Shared overlay within runtime bounds

Mount a toast viewport from `BisView`, supplying it to `PendingOperations` as an overlay slot rendered inside `.bis-runtime` but outside `.bis-runtime-content`. This preserves the existing viewport sizing and prevents inert/aria-hidden account content from hiding notifications. Place the toast above host-local BIS layers without taking focus or changing the operation dialog's blocking behavior.

Use a dedicated absolutely positioned, clipped overlay region within the runtime container; do not change overflow on the entire account UI. Center the text card at the top with a small inset, constrained width, wrapping text, and existing BIS typography/colors. Its entire layer uses `pointer-events: none`. Slide from fully above its clipping boundary, accounting for card height and inset, so the card is completely off-screen at both ends. Do not use a document-fixed toast that would cross into Admin or ignore preview scaling.

Use a polite atomic status announcement, with no focus movement or tab stops. Keep the announcement mechanism mounted and ensure equal consecutive strings produce separate announcements. Verification includes keyboard focus, wrapping, viewport scaling, and reduced-motion preferences.

### 4. D1 uses production behavior

Add a `D. UI` Admin category containing `StoryAction` ID `D1`, label `Show Toast`. Existing story positions remain intact. Wire a dedicated callback in `App` to the active session's `context.showToast('This is a test message from BIS.')`.

Enable D1 whenever the demo session exists, including logged-out and Account-open states; it does not share the account-open/asset-busy disable rules. Repeated clicks enqueue the same text as separate entries. No account navigation, wallet operation, fake payment result, or extra console entry is necessary. Documentation title is `D1. Show Toast`.

### 5. Story appendix and existing Admin tools

The user subsequently specified the naming and organization: D. UI / D1. Show Toast; E. Admin Tools / E1. Fund Signet Sats / E2. Open On Mempool.space; and the old D1-D6 document entries moved to X1-X6 in an appendix. Preserve lettered children as X2a/X2b, X3a/X3b, and X5a/X5b. Rewrite document references, diagram step labels, and anchors consistently, but do not rename historical change directories, external spec identities, or existing runtime account-selection IDs. The current change retains its original scaffold directory name.

Change the existing Tools heading in Admin to E. Admin Tools. Render the same funding and explorer handlers as numbered E1/E2 actions; use the exact explorer label Open On Mempool.space. Both retain `!canFund || funding` disabling. E1 still opens the Signet faucet and attempts to copy the retrieved funding address; E2 still opens that address on the Signet explorer. This is presentation organization, not new funding logic. Add tests for labels, callback routing, and the existing disabled states using isolated handlers without opening a live faucet.

### 6. Optional image refinement

The user requested an optional left-hand image, with trophy notifications showing the trophy asset image. The host passes `imageUrl: trophyAsset.iconUrl` after its own confirmed award result; the generic toast API does not mint assets or infer trophy ownership. The separate C6 workflow owns that trigger.

Render an optional 48px thumbnail to the left of wrapping text, preserving the centered text-only layout when no image is supplied. Use `object-fit: contain` to keep the full trophy visible and empty alternative text because the live announcement carries the message. Accept credential-free HTTPS image URLs and host-root-relative bundled paths. Invalid images are omitted without rejecting the text.

Prepare and decode the queue head's image before entry, for at most 3 seconds. Failed, undecodable, or stalled artwork falls back to text-only and does not block the queue. Start the full hold only after entry; image preparation is not deducted from it. Cancel image callbacks and the deadline on unmount/disposal. The normal text-only path starts without preparation delay.

Browser verification exposed a mobile preview that scrolls into view after mounting. Extend the shared visible-viewport hook to recompute on captured scroll events as well as resize so the toast clipping bounds track the visible host without changing its layout.

## Risks / Trade-offs

- FIFO bursts can delay later messages -> intended confirmed behavior; D1 adds only explicit notifications, with no polling-driven producers or silent deduplication.
- Browser timers can be throttled in background tabs -> test exact phase ordering under a controlled clock and visible timing in a foreground browser; do not promise real-time delivery while suspended.
- Unmount, reset, or StrictMode replay could leave timers or stale entries -> context ownership, cancellable phase scheduling, generation guards, and lifecycle tests.
- An overlay inside inert content could be invisible to assistive technology -> render through the runtime sibling slot and test beside pending/error presentation.
- Short holds cannot guarantee every user reads arbitrary long text -> this is brief, noncritical feedback; callers can override duration and acknowledgment-required errors stay in dialogs.

## Migration Plan

The change is additive: implement and export the notification API, connect shared UI, then wire D1. No data migration or wallet access is needed. Verify the production demo and an independent host fixture in this repository before marking implementation complete. Removing D1 and its API/UI additions through a normal follow-up change would not require data repair. The external game receives the reusable capability when it later consumes an updated BIS build; deploying that update is outside this change.

## Open Questions

No material scope decision remains. Proposed implementation defaults above are recorded for review rather than attributed to the interview. Minor spacing, easing, and color tuning can be finalized during browser verification without changing the behavior contract.

D2 Show Toast With Icon sits beside D1 and passes the existing local Level 1 trophy image URL through the same public API. It shares D1 availability and FIFO delivery without awarding an asset.
