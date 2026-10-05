# Design

## Context

The LTO service already stores encrypted contract state, uses durable end-session markers, and runs a recovery worker after the host UI is disposed. The remaining failure is coordination between disposal, an already-running reconciliation pass, and the cleanup polling lifecycle. See proposal.md for the motivation and specs/limited-time-offers/spec.md for the required behavior.

## Goals / Non-Goals

**Goals:**

- Make disposal-triggered cleanup deterministic when reconciliation is already in flight.
- Scope end-session marking and recovery to the disposed player/game/network/operator identity.
- Preserve single-flight operation and notification guarantees.
- Keep the host-facing LTO API unchanged.

**Non-Goals:**

- Changing Start, Claim, Reject, or Refund semantics.
- Changing contract formats, encrypted storage formats, or wallet signing protocols.
- Adding a server-side recovery service.

## Decisions

- Treat disposal as a durable recovery event, not merely a UI lifecycle event. Capture the disposed player and game identities, mark matching unresolved records, and schedule reconciliation after any active pass has either completed or recorded a queued follow-up.
- Reuse the existing reconciliation and mutation-lock path instead of calling refund logic directly. This preserves receipt verification, reservations, operation transitions, and toast deduplication.
- Filter cleanup by player, game wallet, network, and operator. A broad “all unresolved contracts” cleanup would risk spending another worker's funds.
- Keep the recovery worker alive while its scoped records remain unresolved; stop polling and dispose its storage subscriptions only after no matching unresolved record remains.
- Test the ordering with deterministic mocked timers and delayed funding/refund adapters. This is preferable to relying on wall-clock expiry or provider calls in the regression test.

## Risks / Trade-offs

- [Risk] A provider or storage outage may keep the worker alive longer. → Mitigation: retain durable records and reservations, retry through the existing reconciliation loop, and never report success without verified terminal evidence.
- [Risk] A replacement worker may overlap disposal cleanup. → Mitigation: use the existing browser mutation lock and reconciliation single-flight queue, and assert at-most-once refund submission in tests.
- [Risk] Legacy records may lack explicit network metadata. → Mitigation: resolve them through the active network-scoped store and preserve the existing defaulting rules without accepting an explicit mismatch.
