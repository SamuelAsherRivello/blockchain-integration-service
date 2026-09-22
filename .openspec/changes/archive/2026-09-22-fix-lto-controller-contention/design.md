# Design

## Context

See [proposal.md](proposal.md) for motivation. The LTO service already has durable contract records, per-wallet mutation locks, host session IDs, and host-supplied exclusivity keys. The failing area is the boundary between per-session idempotency and cross-controller exclusivity: a rejected or cached attempt must keep its own session from starting late, but it must not prevent a later fresh session from competing for the key.

## Goals / Non-Goals

**Goals:**
- Make simultaneous Start LTO requests deterministic across cooperating controllers.
- Preserve one-off session idempotency and no-late-start behavior.
- Preserve existing cleanup, refund, unknown-outcome and input-reservation semantics.
- Keep game-facing APIs protocol-neutral and free of Arkade-specific types.

**Non-Goals:**
- Do not change the public LTO request/result API shape.
- Do not introduce a server-side signer or new persistent storage backend.
- Do not broaden this change into C1 asset delivery, wallet onboarding, or Marketplace flows.
- Do not claim new live Signet acceptance without explicit live verification.

## Decisions

### Separate session-attempt markers from live promise caching

Keep a durable marker keyed by player, game, exclusivity key and session ID so a readiness-failed or skipped session cannot start later. Treat the in-memory `attempts` promise cache as a short-lived deduplication aid for the exact same session request, not as the authority for future fresh sessions.

Alternative considered: delete every failed attempt marker so a later retry can succeed. That would reintroduce late-start behavior for a session that had already been skipped by the host.

### Let exclusivity acquisition happen under durable service state

Fresh sessions should pass through the existing prior-offer cleanup and durable contract allocation path. The slot winner is determined by the persisted ledger/reservation state and mutation locks, not by whichever controller first stores an in-memory promise.

Alternative considered: add a separate localStorage mutex for exclusivity keys. The existing wallet mutation and contract storage locks already protect funds and records; adding a second ad hoc lock would increase recovery complexity.

### Keep losing controllers session-local

When a controller loses a contention race, its session remains no-offer/unavailable and must not adopt a contract created for another session. Matching remains based on session ID, host reference, player ID and game ID.

Alternative considered: let all controllers observe the winning contract. That would make G2 demos appear successful in multiple tabs and could allow duplicate claim attempts for the same visible reward.

### Strengthen regression coverage before browser smoke

First fix the focused service-level contention test so it proves exactly one winner. Then verify the treasure session wrapper cannot attach a losing session to another session's contract. Browser fixture coverage should be used after unit behavior is stable.

Alternative considered: begin with browser-only testing. That would be slower and less precise for the concurrency bookkeeping bug.

## Risks / Trade-offs

- [Risk] Removing or narrowing in-memory cache behavior could permit duplicate submissions for the same exact session. → Mitigate with an explicit same-session idempotency assertion in `lto-service.test.mjs`.
- [Risk] A stale durable marker could block an intentional retry of the same session. → This is intended for host Start sessions; retries should use a fresh session ID after cleanup.
- [Risk] Cleanup timing may make one fresh start appear unavailable even though the previous refund later succeeds. → Preserve the existing spec: the skipped session does not start late after later cleanup.
- [Risk] Browser multi-tab behavior can differ from fixture locks. → Keep the existing browser LTO fixture in the verification list when practical.

## Migration Plan

No data migration is expected. Existing unresolved contract records and recovery journals remain authoritative. If the implementation regresses, rollback is code-only: restore the previous LTO service coordination while leaving durable records untouched.
