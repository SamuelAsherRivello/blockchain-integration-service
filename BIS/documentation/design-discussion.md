# BIS design discussion

This document records durable design decisions for Blockchain Integration Service. It is intentionally concise: dated feature detail, acceptance evidence, and unimplemented proposals live in [OpenSpec](../../openspec/) and the [user-story diagrams](User%20Story%20Diagrams.md).

## Integration boundary

BIS is a reusable browser-game integration layer, not the game. A consuming game owns scenes, gameplay state, user-visible game consequences, and host composition. BIS owns its documented public contract, account and wallet workflows, production UI, and provider integration. A host uses public exports and does not import private wallet or UI implementation files.

## Layer ownership

The integration package separates core state/workflow ownership, production UI, and Arkade adapters. Core code owns validation, persistence, operation coordination, and public state/events. Production UI owns presentation and interaction. Arkade adapters own SDK-specific calls. This separation keeps protocol-specific types and recovery material out of the host-facing contract.

`BisService` is the lifecycle-facing composition boundary for games. It composes existing controllers and context rather than taking ownership of their domain rules. Games provide effects through the protocol-neutral `IBisGame` interface and retain responsibility for applying a confirmed outcome.

## Truthful financial and recovery behavior

Network, account, balance, transfer, and asset states must distinguish success from unavailable, pending, failed, or unverified conditions. The UI and public events must not manufacture successful outcomes. Recovery phrases and signing material remain private, are never logged or emitted, and must be handled by the user outside shared evidence.

Browser persistence is origin-scoped. Logout, reset, disposal, and cross-context behavior must preserve the public contract and must not silently recreate cleared identity or conceal unresolved operations.

## Documentation and planning

The root README and package READMEs explain entry points and commands. OpenSpec owns proposals, requirements, implementation tasks, and archival verification. When a proposed workflow lacks an OpenSpec record, documentation must describe it as deferred rather than linking to an invented or missing artifact.

## Decision review trigger

Revisit these decisions when a change alters public host contracts, ownership across core/UI/adapter boundaries, supported network policy, recovery handling, or the project’s no-custom-server constraint.
