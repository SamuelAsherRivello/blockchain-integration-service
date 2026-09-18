## Context

The Account Assets UI calls `BisContext.burnAsset`, which acquires the shared browser wallet-mutation lock before reading the stable account and invoking `burnWalletAsset`. The context currently maps every non-`BurnError` exception to the generic `Burn unavailable` message. The low-level burn path also uses an `ifAvailable` lock acquisition, depends on a fresh balance and asset-details read, captures exact input outpoints before the SDK submission, and currently defaults its provider factory to Signet unless the caller supplies a network.

The existing `asset-burning` and `wallet-operation-availability` specifications require exact holdings, reservations, durable intent, and conservative unknown-outcome handling. The fix must preserve those guarantees while making pre-submit contention and verification failures distinguishable from post-submit uncertainty.

## Goals / Non-Goals

**Goals:**

- Identify the real intermittent failure class with focused tests around the context boundary, shared lock, provider/network routing, persistence, and SDK burn seam.
- Let a valid burn proceed after short-lived unrelated wallet contention without permitting duplicate or conflicting submissions.
- Route the burn through the active verified network and preserve exact asset/input validation.
- Return actionable safe error codes/messages and retain durable recovery for any possibly submitted burn.
- Verify the real browser Account Assets flow and the Admin H2 batch behavior after the unit fix.

**Non-Goals:**

- No automatic retry after the SDK submission boundary or inferred success from a missing asset.
- No weakening of pending-operation reservations, account-change guards, or explicit Burn confirmation.
- No new Arkade types in the game-facing API, no recovery-material logging, and no custom server.
- No change to the separate Stealth game repository in this planning change.

## Decisions

1. **Classify failures at the context boundary.** Preserve typed `BurnError` categories and introduce only the minimum additional safe classification needed for lock/provider/persistence failures. Unexpected SDK errors will be sanitized, but the implementation will retain enough internal branching to distinguish before-submission failure from possibly submitted failure.

   Alternative rejected: changing only the user-facing string. That would hide the cause and would not make a valid burn execute.

2. **Use bounded coordination for pre-submit lock contention.** Reuse the shared account/network mutation key and wait/retry only before the burn submission boundary. Each retry must re-read the active account and reservations; exhaustion returns an explicit temporary-busy result.

   Alternative rejected: removing `ifAvailable` or waiting indefinitely, which could make the UI hang and would weaken cross-context coordination.

3. **Pass the verified account network through the burn provider factory.** The burn must use the same selected network used by account restore/listing and reject mismatched operator information before intent/submission.

   Alternative rejected: retaining a Signet default in a network-aware context, which can produce a false unavailable result or route a burn to the wrong operator.

4. **Keep durable intent and unknown-outcome rules unchanged.** The implementation will improve only the pre-submit path and error classification. Once the SDK may have submitted, it will retain the pending record, exact inputs, and no-resubmit rule.

   Alternative rejected: retrying a generic failure blindly, which can double-spend or duplicate a burn.

5. **Test through injected seams and a browser host.** Add deterministic lock/provider/persistence fixtures for the intermittent cases, then exercise the actual Account Assets confirmation and refresh flow. Any live Signet verification will be recorded separately and will never be replaced by a mock claim.

## Risks / Trade-offs

- [Risk] A provider can fail after accepting the transaction but before returning its ID. → Keep the submission boundary and pending record conservative; require reconciliation evidence before completion.
- [Risk] Waiting for a lock can make a Burn click feel slow. → Bound the wait, expose busy status, and keep unrelated UI usable.
- [Risk] Network-aware routing may expose existing records created under the old Signet-only key. → Preserve legacy recognition only where safe and reject cross-network records before signing.
- [Risk] Existing fixtures may rely on generic thrown errors. → Update focused tests to assert safe public categories while keeping private provider details out of results.
