# Design

## Context

See proposal.md. Installed Arkade SDK castMetadata accepts strings, numbers, and bytes, rejecting arrays/boolean/null. Its indexer parser hex-encodes custom metadata. BIS currently sends bisAttributeDeltas arrays directly and casts decoded strings to arrays during normalization. Shared inventory has no deadline, and Marketplace wallet status subscriptions restart reads.

## Goals / Non-Goals

Goals: preserve provider-neutral structured metadata, truthful ownership, network isolation, finite loading, and recoverable operations. Non-goals: automatic burning, fabricated ownership, clearing recovery journals, or changing the nine catalog definitions.

## Decisions

- Serialize supported custom arrays as JSON strings at the Arkade issuance boundary; parse only the bisAttributeDeltas field after custom hex decoding and run existing validation. Preserve typed API values. Direct arrays fail SDK encoding; inferring gameplay values from catalog data violates chain authority.
- Add a shared inventory deadline that races even a signal-ignoring provider, aborts on expiry, removes pending work, and suppresses late cache publication. Share the same safe result mapping for all callers.
- Deduplicate Marketplace reads for the same scope; unavailable state requires explicit retry, unless identity/network or actual ownership changes. Remove broad activity/assets loading-status invalidations to prevent read-feedback loops.
- Use one inventory API attempt instead of preparation followed by an automatic second listing. Set deadlines so the shared attempt ends before the UI guard. Retry removes the previous error and starts only the affected wallet; Cancel suppresses only this inventory notice.
- Audit selected network propagation at source/recipient and provider boundaries. Existing network-scoped stores and guards remain authoritative. Reject explicit mismatches and invalidate stale results.
- Browser acceptance uses Admin mint/list and Marketplace purchase with funded selected accounts; record public evidence only. Verify gameplay in the separate game repository using the updated integration package. Live success is not inferred from mocked tests.

## Risks / Trade-offs

- Immutable legacy metadata: retain generic/migration-required visibility; inspect exact holdings before any separately confirmed destructive migration.
- Unknown submission: preserve operation IDs and reservations; only retry reads automatically through user action.
- Signal-ignoring SDK requests: deadlines must race promises and gate late results, not merely abort a signal.
- Missing authenticated browser: provide a visible Edge session for user account access while continuing independent verification.

## Migration Plan

Apply transport/lifecycle repairs, run regression checks and builds, then verify selected network and current holdings in Admin. Reconcile unresolved operations before minting missing catalog items. Verify nine fresh holdings, purchase one, and validate its chain deltas in gameplay. Preserve existing journals on rollback.
