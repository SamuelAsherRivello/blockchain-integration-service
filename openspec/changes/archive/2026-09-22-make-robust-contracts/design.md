# Design

## Context

`make-robust-assets` already made the LTO controller and wallet-readiness paths network-aware. The remaining contract boundary is persistence: the encrypted contract document, browser reservations, and some coordination names still have Signet-only or networkless boundaries even though contract records carry network/operator scope.

## Goals / Non-Goals

**Goals:**

- Make contract recovery and reservation persistence obey the same active network/operator boundary as LTO funding, claim, refund, and reconciliation.
- Preserve unresolved legacy recovery without treating missing or legacy metadata as proof that another network is safe to use.
- Keep same-network cooperating tabs serialized while allowing independent networks to proceed independently.
- Make logout and reset inspect and clear only the contract state belonging to the applicable network and wallet role.

**Non-Goals:**

- Do not repeat the completed `make-robust-assets` transient-state or G2 work.
- Do not change equipment, continuation, or general wallet-role namespaces; those require a separate client-state isolation change.
- Do not expose recovery phrases, encrypted keys, or provider secrets through public APIs.
- Do not introduce a server or a new persistence dependency.

## Decisions

### Decision: Use network-scoped contract storage boundaries

Add a network parameter at the contract-storage boundary and use a network-scoped storage selector where a long-lived service can observe network changes. The IndexedDB database name and any reset/recovery operation are derived from the selected network. Contract records still retain their explicit network and operator fields for validation; storage scoping is defense in depth, not a replacement for record validation.

Alternative considered: keep one shared encrypted ledger and filter every query by network. This leaves reset, revision, recovery, and corruption boundaries shared and does not satisfy the existing network-isolation requirement.

### Decision: Version contract reservations and include network scope

Write new reservations under a network-specific v2 key and include `network` and `operator` in each serialized entry. Read legacy Signet reservations only as Signet compatibility data, validate them conservatively, and never migrate them into Mutinynet state. A legacy entry that cannot be assigned safely remains a spending hold rather than being discarded.

Alternative considered: infer a missing reservation network from the current UI network. This could reinterpret a Signet reservation as Mutinynet after a network switch and would violate the isolation contract.

### Decision: Keep active-network coordination at the service boundary

Contract service locks and any contract-specific recovery coordination names include the active network. The service revalidates network, operator, player identity, and game identity immediately before reading recovery state and before submission. General wallet-role and browser mutation locks remain outside this change.

Alternative considered: reuse one global lock for all networks. It is simpler but creates unnecessary cross-network blocking and obscures which state is protected.

### Decision: Preserve legacy state without broad automatic migration

Existing Signet state remains readable in Signet scope. The implementation may copy or version it into the new Signet namespace only after validation and without deleting the source until the new state is durably verified. No legacy record is automatically assigned to Mutinynet. Reset and logout tests must prove unresolved records survive unrelated-network operations.

## Risks / Trade-offs

- [Risk] A migration can duplicate or strand unresolved recovery. -> Mitigation: use compare-and-swap revisions, preserve the legacy source until verified, and test reload during migration.
- [Risk] A network-specific reservation key could hide a legacy Signet hold. -> Mitigation: Signet compatibility reads remain supported and incomplete legacy entries conservatively block spending.
- [Risk] Network changes during an in-flight contract operation could write to the wrong store. -> Mitigation: capture the operation network, revalidate current identities and network at every signing boundary, and discard stale service results without clearing another network's state.
- [Risk] Separate stores reduce cross-network visibility during debugging. -> Mitigation: Account Contracts and recovery reports expose sanitized network/operator metadata while keeping secrets private.

## Migration Plan

1. Add failing tests for current Signet and Mutinynet contract storage, reservation, reset, logout, and concurrent-operation behavior.
2. Introduce versioned network-scoped storage and reservation readers with conservative Signet compatibility handling.
3. Bind LTO service creation, reconciliation, and cleanup to the active network-scoped contract store.
4. Add network-qualified contract coordination names and verify same-network serialization plus cross-network independence.
5. Run focused storage, LTO, wallet-availability, logout/reset, and network-selection tests, then validate the change artifacts.
6. Roll back by reverting the implementation while retaining legacy state; do not delete or overwrite unresolved recovery during rollback.
