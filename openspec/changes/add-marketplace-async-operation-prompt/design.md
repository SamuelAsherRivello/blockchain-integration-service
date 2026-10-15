## Context

The Marketplace owns checkout orchestration in `BIS/packages/marketplace/src/App.tsx`, while `@bis/integration` owns the rendered BIS account UI and its private `PendingOperations` / `usePendingNotice` composition. The Marketplace currently mounts the account UI in a fixed host but has no foreground checkout loading state. The existing checkout change deliberately makes durable unresolved records item-scoped and nonblocking after a foreground attempt has ended.

## Goals / Non-Goals

**Goals:**

- Reuse the actual BIS pending dialog, backdrop, bolt, focus containment, and reduced-motion behavior for Marketplace initial preparation plus Buy and Sell work.
- Make a trade attempt visibly and accessibly blocking only while it is actively advancing and refreshing its rendered results.
- Preserve recovery accuracy: a durable unconfirmed checkout stays unresolved and item-scoped after the foreground prompt ends.

**Non-Goals:**

- Change payment/delivery ordering, wallet authority, recovery semantics, catalog behavior, or the Account UI.
- Cover background reconciliation, passive inventory reads, Admin operations, or an unresolved settlement wait with the dialog.
- Add a UI dependency or duplicate BIS dialog CSS in the Marketplace package.

## Decisions

### Expose one reusable BIS pending-presentation boundary

Export the minimal existing pending container and notice binding needed by a React host through `@bis/integration`, then compose Marketplace content inside that boundary. This retains one implementation of the overlay, dialog semantics, bolt animation, focus/inert behavior, and reduced-motion rule. The Marketplace must not copy the DOM/CSS or independently approximate its layering.

Alternative considered: add Marketplace-local modal markup styled to resemble BIS. Rejected because it will drift from the approved dialog and duplicates accessibility responsibilities.

### Model active checkout presentation separately from durable checkout state

Add shared busy inputs for initial catalog/required visible inventory preparation and for a foreground operation state entered synchronously before any Buy or Sell await. Clear each only after the terminal confirmation plus required relevant refresh/render readiness. Labels change only among user-facing `...ing...` operation phases. Durable checkout records remain the source of truth for exact item, direction, and recovery; a record becoming `pending` ends foreground presentation and returns the operator to the existing item-scoped status.

Alternative considered: derive modal visibility directly from `checkout.status === 'pending'`. Rejected because recovery can last indefinitely and the existing item-scoped contract explicitly keeps unrelated safe work available.

### Keep the shared overlay above Marketplace and Account host layers

Compose the pending boundary at the Marketplace application root and verify its stacking order over the existing fixed BIS account mount. When a trade is eligible the Account flow is no longer the active interaction, but the overlay must still block any stale or visually underlying controls. Retain the host-scoped presentation rather than using a document modal so the integration remains embeddable.

Alternative considered: use a document-level dialog. Rejected because the existing BIS component avoids it to prevent disabling unrelated host UI.

### Treat terminal results according to existing BIS semantics

Clear the prompt only after confirmed checkout and refresh readiness. Route a thrown foreground failure through the shared terminal error state and its acknowledgement behavior. For a durable unconfirmed outcome, do not report an error as completion: end the foreground spinner and show the existing recovery state for the affected item.

## Risks / Trade-offs

- [Shared component export broadens the public UI surface] → Export only the explicit pending boundary/hook needed by Marketplace and cover it with package-boundary tests.
- [Async state can clear before inventory/equipment render catches up] → Define the busy lifetime around the existing revision/refresh completion states and assert final DOM visibility in browser tests.
- [Nested overlay stacking could leave account controls reachable] → Add a real-browser assertion that the centered dialog/backdrop is topmost and covered controls are not interactive.
- [A future checkout remains unresolved for a long time] → Keep the foreground prompt finite; retain only the already durable item-scoped recovery state afterward.

## Migration Plan

1. Add public shared-pending composition without changing existing BIS consumers.
2. Wrap Marketplace content and connect its Buy/Sell foreground lifecycle to the shared notice.
3. Add focused tests and a browser smoke test for initial preparation, Buy, Sell, terminal failure/unconfirmed recovery, motion reduction, and post-refresh reveal.
4. Roll back by removing Marketplace's new composition/state; no storage, wallet, checkout record, or network migration is involved.
