# Design

## Context

The existing Prototype Sandbox Mint Asset demo calls the Arkade SDK issue operation and stores the returned asset ID for later asset demos. It does not send the issued asset. The new page can therefore use the same mnemonic-backed wallet as both issuer and current holder. See `proposal.md` for the motivation and `specs/prototype-asset-upgrade/spec.md` for the observable contract.

## Goals / Non-Goals

**Goals:**

- Show a real level-one-to-level-two replacement using the installed Arkade SDK.
- Keep Mint Asset atomic and unchanged in its send behavior.
- Make the multi-phase operation retry-safe and truthful when a response is lost.
- Teach the distinction between asset replacement and native reissuance.

**Non-Goals:**

- No smart contract, covenant, control-asset reissuance, or player-to-player delivery.
- No changes to the existing Mint Asset operation or its wallet profile model.
- No claim that a browser-local journal provides server-grade game authorization.
- No simulated success, fabricated transaction IDs, or secret material in output.

## Decisions

### Use the existing minted holding as the source

The source selector will resolve the same network-and-label key already written by Mint Asset. This preserves atomic demos: Mint creates and holds the source; Upgrade consumes that holding and creates its replacement. A separate Send step remains available for teaching ordinary transfers, but is not a prerequisite for this demo.

### Use one mnemonic-backed wallet for the prototype

The wallet used by the existing Mint Asset source is also the signer and immediate recipient of the replacement. This removes an unnecessary delivery phase while still demonstrating the essential replacement semantics. A later production-oriented flow can introduce a distinct game and player wallet boundary.

### Treat upgrade as issue, verify, then burn

The replacement is issued with level-two metadata and a new asset ID. The source is read from fresh wallet state before mutation and is burned only after replacement evidence is available. The source and replacement IDs are linked in the recovery record and output; the asset metadata remains immutable.

### Persist a public-only browser journal

The prototype will use the sandbox's durable storage boundary for a small record containing operation identity, network, source asset ID and quantity, target metadata/version, replacement asset ID, phase, and public transaction IDs. The implementation may use IndexedDB or the existing storage adapter if it provides equivalent durable same-operation protection. Recovery phrases and signing material are excluded.

### Keep recovery phase-based and idempotent

The record is written before the first mutation. Each phase is advanced only after its own evidence is observed. Retries reconcile the exact recorded operation, never infer completion from a missing holding, and never create a new replacement or burn request for the same operation identity.

## Risks / Trade-offs

- [Risk] A browser-only journal can be cleared or lost, so it is not a complete production authorization service. -> [Mitigation] Label the demo as a client-side recovery example and retain public transaction evidence; production game authorization remains out of scope.
- [Risk] Minting and burning are separate Arkade operations and can leave a temporary duplicate or temporary source holding. -> [Mitigation] Replacement-first ordering, exact source checks, durable phase records, and no automatic duplicate retry.
- [Risk] The existing minted metadata is generic rather than a complete game item schema. -> [Mitigation] Use a small explicit level-two replacement envelope for the demo and keep gameplay authority outside this generic prototype.
- [Risk] Provider or operator availability can interrupt live work. -> [Mitigation] Fail closed, preserve the pending record, and report recovery rather than simulated success.

## Migration Plan

No migration is required. Add the new route and namespaced upgrade journal while preserving existing Mint Asset local-storage keys and existing asset records. If the demo is rolled back, previously issued on-network assets remain user-owned and must not be silently burned.
