# Design

## Context

See [proposal.md](proposal.md). Marketplace already persists a checkout request and reuses its ID as the asset-delivery operation ID. The delivery journal records request identity and, after submission, transaction evidence; existing reconciliation validates recipient ownership, asset identity, quantity, and source reduction. The shared BIS toast API already supports typed text and optional validated artwork, while generic receipt observation is intentionally independent.

## Goals / Non-Goals

**Goals:**

- Derive delivery-toast milestones from the durable checkout and delivery lifecycle rather than button presses, amounts, or activity heuristics.
- Present an item image only from the selected item's already validated chain-derived presentation data, and use the Player Wallet's verified transfer direction for confirmation wording.
- Deduplicate lifecycle notifications across the initial attempt and polling-based recovery without changing recovery semantics.

**Non-Goals:**

- Suppressing, changing, or correlating incoming-sats notifications.
- Treating an Arkade carrier amount as a delivery identifier.
- Adding a toast for failed, unknown, or merely prepared delivery work.
- Changing catalog artwork validation or Arkade SDK behavior.

## Decisions

### 1. Make delivery lifecycle evidence the notification authority

The pending toast is published only when the delivery journal has a transaction ID, because the checkout's `delivery-submitted` phase is recorded before the wallet call and therefore does not itself prove submission. The confirmed toast follows successful existing reconciliation and durable checkout-leg confirmation. This uses the recovery model as the source of truth and avoids reporting a pending transfer for a preflight failure.

An optimistic toast at button press was considered and rejected because it would claim delivery activity before durable submission evidence exists.

### 2. Keep delivery state notifications separate from payment receipts

Marketplace invokes the active Player Wallet context's existing public toast entry point with explicit delivery text, direction-aware confirmed wording, and semantic type. Built-in producers use approved sentence templates, with paired pending and confirmed text that differs only by the final `(Pending)` or `(Confirmed)` suffix. Unavailable, expiry, and failed messages have no suffix. It does not extend the generic payment observer or use the carrier sats amount, Arkade transaction ID, or receipt timing to decide whether a payment toast is shown. The queue preserves normal arrival order when the payment and delivery notifications occur near each other.

Receipt suppression was considered and rejected because the user explicitly wants every incoming-sats notification retained and because payment observation can precede durable delivery correlation. A verified sender journal may label a receipt from the selected Game Wallet as `Game Wallet`; otherwise the established user label remains.

### 3. Carry the selected item's validated presentation data through checkout notification publication

The Marketplace selected item and current transfer direction are the presentation source for its own toast. Its name and already validated chain-provided icon URL accompany only the local toast call; no name-based catalog fallback is performed. The shared toast image preparation/fallback path remains responsible for invalid or failed artwork. Current purchases and sell-backs use this path, and a future trade flow must supply the same Player Wallet involvement and direction evidence before it can publish a toast.

Reload recovery must obtain the item presentation from current verified Marketplace inventory before emitting a new notification. If it cannot do so, it must not fabricate a name or image; the durable checkout remains recoverable without a new toast.

### 4. Use durable notification markers scoped to checkout, delivery phase, recipient session, and network

The Marketplace view needs a small local, non-secret deduplication record so a re-render or the 2.5-second recovery poll cannot replay pending or confirmed delivery toasts. The marker is written only after the matching toast is accepted for the current checkout, Player Wallet profile, network, transfer direction, and milestone. A session replacement, logout, network change, or stale callback must not publish or recreate a marker.

In-memory-only deduplication was rejected because refresh and recovery can span a page reload. Reusing the generic payment notifier's receipt keys was rejected because delivery and payment messages have different semantics and the payment notification must remain visible.

### 5. Keep approved copy at the producer boundary

Each producer owns its literal template. Incoming receipts resolve `{user}` from verified sender evidence and use `Game Wallet` only for the selected Game Wallet profile. Bitcoin and Arkade transfer, continuation payment, item delivery, trophy, and limited-time-offer producers use the approved templates from the toast-messaging specification. This preserves literal caller-provided content and avoids a queue-level text rewrite that could alter identifiers or external messages.

## Risks / Trade-offs

- [The transaction ID is absent because submission acknowledgement was lost] -> Do not emit a pending toast; retain the existing unknown/recovery state until fresh reconciliation produces terminal evidence.
- [The selected item is unavailable after a reload] -> Do not invent display content; skip the new toast while preserving durable checkout recovery.
- [A tab reloads after a toast but before a marker write] -> Persist the marker as part of the same local lifecycle boundary and cover the ordering with tests.
- [The generic incoming-payment toast and delivery toast are close together] -> Rely on the existing FIFO shared queue; do not merge or suppress either notification.

## Migration Plan

1. Add focused lifecycle and presentation tests before changing Marketplace notification behavior.
2. Implement durable, scoped delivery-toast markers and publication at evidence-backed pending and confirmed milestones.
3. Run Marketplace checkout, integration toast/payment-notification, and relevant browser tests; verify the existing receipt cases remain unchanged.
4. Roll back by removing Marketplace delivery-toast publication and markers; checkout and generic receipt behavior remain intact.
