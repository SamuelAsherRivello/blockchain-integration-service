# Design

## Context

See proposal.md for the follow-up boundary. The prerequisite `add-bis-server-game-wallet` already delivers bis-server locally/on Vercel, server-held identity, private configuration, signing authorization/coordination, client source selection, manual fallback and released Admin/Marketplace/Stealth & Steel consumers. Those are inputs to this change, not deliverables postponed from milestone 1.

The browser still owns transaction preparation, submission and recovery after milestone 1. Existing SDK asset operations and their network-evidence rules provide the behavioral baseline for a server operation implementation. Reconcile with the accepted milestone 1 interface and current SDK before applying this follow-up.

## Goals / Non-Goals

Goals: own complete mint/delivery operations on the server, deduplicate exact retries and expose durable progress/receipts across requests, browsers and server restarts.

Non-goals: changing trophy economics, game completion authority, general account authentication, cloud saves, full marketplace settlement migration or autonomous recovery with no requests. Existing local manual mode remains available under milestone 1 rules.

## Decisions

### Reuse the accepted milestone 1 deployment

Extend its service and shared datastore rather than provisioning another server or wallet. Expose versioned mint, delivery and operation-status capabilities alongside the compatible signing protocol. Retain current same-Vite local routing and Pages-to-Vercel configuration. Never turn capability absence into silent local signing for an existing server operation.

### Durable operation ownership

Use atomic intent creation keyed by game, identity, network, authorized actor and operation ID. Store the normalized request digest, captured policy/grant, input reservations, submission evidence and final receipt. Exact retries join or return the original operation; mismatched payloads fail. Keep each mint and subsequent delivery stage explicit so delivery retry never repeats minting.

Persist before signing/submission. If a response disappears after submission, reconcile original inputs and transaction evidence. Release reservations only with evidence that permits it; neither lock expiry nor HTTP timeout proves failure. Extend milestone 1's signing ledger into an operation journal rather than conflating signatures with successful operations.

Operation API calls own preparation, signing, submission and reconciliation. The browser owns presentation, polling and gameplay effects. Public BIS game contracts remain free of SDK-specific protocol types. Refresh and new authorized status requests resume recovery after client closure; an independent durable worker is outside this proposal.

### Operation-level authority

Reuse milestone 1 authentication and bounded spending controls, adding grants bound to game/network/recipient/item/operation/quota. Atomically consume quotas with intent creation so retries do not consume twice and new operation IDs cannot bypass budgets. Server item definitions control mint content. Owner administration remains private. A client-reported level completion does not become verified gameplay evidence.

### Capability-based rollout

First migrate mint and delivery as complete vertical operations. Show unsupported operations explicitly and leave their original supported source behavior intact. Preserve pending milestone 1 operations on their original protocol/version. Any change to fee payer or trophy policy requires its own affected spec update, not an incidental server migration.

## Risks / Trade-offs

- Duplicate issuance after lost acknowledgments: persist intent before signing and reconcile each mint/delivery stage independently.
- Competing requests across Functions: use the existing shared datastore with atomic wallet/input reservations and exact-request checks.
- Client closure: retain durable evidence and resume on later requests; do not promise continuous execution while idle.
- Two API generations: advertise versions and retain recovery compatibility until old pending work is resolved.
- Scope growth: complete only mint/delivery and documented recovery; keep gameplay authority, reward economics and unrelated platform features separate.

## Migration Plan

Start only after milestone 1 acceptance and explicit instruction to apply this follow-up. Extend storage and API under compatible capabilities, then adapt clients to prefer complete server operations where advertised. Run deterministic concurrency/recovery checks plus approved live mint/delivery verification locally and on Vercel. Release an updated verified BIS package to consumers if required, using the established release workflows. Rollback disables new operation creation while status/reconciliation and old signing recovery remain available.
