# Design

## Context

See `proposal.md` for motivation. The current implementation already centralizes static network metadata in `test-network.ts` and resolves operators through `operatorFor`, but live operator policy interpretation is still duplicated in operation adapters. Transfer and contract code reject fee strings by exact text, while direct send already treats the full fee schedule as reviewed quote material. This change keeps the browser-only, no-custom-server model and makes the shared policy explicit.

## Goals / Non-Goals

**Goals:**

- Create one BIS-owned source for supported network metadata and normalized live operator policy.
- Normalize zero-equivalent fee encodings consistently across operations.
- Give each operation a capability decision that can be surfaced before a blocked review or confirmation.
- Preserve existing quote/revalidation safety: fresh policy and reviewed terms must still match at submission.
- Keep game-facing APIs provider-neutral and free of Arkade SDK types.

**Non-Goals:**

- Do not add a backend service, remote configuration system, or public operator proxy.
- Do not declare nonzero transfer, onboarding, contract, or asset policy support until those fee formulas and recovery paths are separately verified.
- Do not weaken pending-operation reservations, mutation locks, journal validation, or recovery uncertainty rules.
- Do not automatically migrate, clear, cancel, or replay existing unresolved wallet operations.

## Decisions

### Centralize network policy in core with Arkade-facing adapters

Add a core wallet-network policy module that exposes plain BIS types: supported network ID, configured operator URL, normalized fee policy, operator limits, freshness metadata, and capability reason codes. Arkade adapters may create SDK providers to read `/info`, but they return only sanitized, provider-neutral policy results to core/UI consumers.

Alternatives considered:

- Keep each adapter's fee parsing local. This is the current failure mode and makes representation drift easy to miss.
- Put normalized policy entirely in the UI. That would not protect direct API calls, background onboarding, or submission revalidation.

### Normalize fees before operation capability checks

Represent fee values as parsed categories: `zero`, `nonzero`, `missing`, `malformed`, or `unknown`. Empty string, `0`, `0.0`, and other finite decimal zero strings are zero. Any nonzero decimal, unparsable value, or missing required shape becomes a distinct unsupported/unavailable reason depending on what is known.

Operations that are verified only for zero fees consume `policy.zeroFees === true`. Operations such as direct send still bind the complete normalized/raw-equivalent policy into the quote fingerprint so policy drift invalidates a stale review.

Alternatives considered:

- Accept only `""` and `"0"` as zero. This preserves today's brittle behavior.
- Treat all unparsable values as zero. That would hide real operator changes and could submit unsupported transactions.

### Separate static network definitions from fresh operator policy

Static metadata remains the app's allowlist: network label, operator endpoint, explorers, faucet details, and known operation support flags. Fresh policy is read from the configured operator and must confirm the expected network. Capability checks combine both pieces and return a reason code such as `network-mismatch`, `policy-unavailable`, `unsupported-fees`, `insufficient-funds`, or `reserved-inputs`.

Alternatives considered:

- Trust SDK provider setup alone for network identity. Existing code already shows explicit network checks are needed.
- Persist live policy indefinitely. That would create stale capability claims; policy should be reread or revalidated at operation boundaries.

### Require policy revalidation at submission boundaries

Quotes/reviews keep their current safety model: they bind account, network, selected inputs, operation amounts, outputs, assets where relevant, and normalized policy. Confirmation rereads or revalidates current policy and rejects stale reviews without submission when policy has changed.

This preserves the direct-send model and extends the same shape to transfer and onboarding code without claiming nonzero fee support.

### Surface availability before avoidable modal errors

UI controllers should be able to ask for operation availability and display a specific reason before a user reaches a review/confirm action that would fail for policy reasons. Existing modal error surfaces remain useful for races and unexpected failures, but predictable unsupported policy should be presented as operation availability.

## Risks / Trade-offs

- **Risk: Different operations genuinely need different fee semantics.** -> Keep capability checks operation-specific; the shared layer normalizes policy but does not decide that every operation supports the same policy.
- **Risk: Raw policy changes could break quote fingerprints.** -> Define a stable canonical normalized representation for quote binding, and include the raw values only if they are sanitized and deterministic.
- **Risk: A stale policy read could make UI look available briefly.** -> Treat availability as advisory and continue hard revalidation at quote and submission.
- **Risk: Tests may overfit current operator examples.** -> Unit-test categories and edge cases, and keep live checks as evidence, not as deterministic test dependencies.
- **Risk: Existing unresolved operations were created under older policy logic.** -> Preserve their records and recovery rules; only new reviews/submissions consume the new capability check.

## Migration Plan

1. Add the shared policy types, fee normalization, and active-network policy reader.
2. Replace adapter-local network/fee parsing in transfer, onboarding, contracts, and send with the shared policy result.
3. Thread policy reason codes into operation availability and user-facing errors.
4. Add focused tests for decimal-zero fee policy, unsupported nonzero terms, network mismatch, stale policy after review, and existing reservation behavior.
5. Validate with isolated suites first, then run typecheck/build. Live verification may read Signet/Mutinynet policy, but no live submission is required for this planning change.

Rollback is straightforward if the implementation stays additive: operation adapters can temporarily call the shared reader and still keep their existing hard guards until each path is migrated. If a migrated operation regresses, revert that operation to the prior local guard while preserving the shared normalization tests.
