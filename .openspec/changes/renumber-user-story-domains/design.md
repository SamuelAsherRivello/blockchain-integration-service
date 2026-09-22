# Design

## Context

The current story catalog and Admin navigator use historical A-H/X labels, while the current implementation spans Player Wallet, Game Wallet, contracts, transactions, and Admin-only responsibilities. See `proposal.md` for the motivation and scope. The existing `story-driven-demo` capability already requires synchronized story documentation and Admin presentation.

## Goals / Non-Goals

**Goals:**

- Establish one authoritative six-domain and lane taxonomy for documentation and Admin navigation.
- Make Player Wallet versus Game Wallet responsibility visible without changing wallet behavior.
- Renumber story references from scratch while preserving historical traceability.
- Keep implementation status and the implemented-only Admin control rule truthful.

**Non-Goals:**

- No changes to wallet protocols, transaction flows, asset metadata, persistence, or public integration APIs.
- No renaming of archived OpenSpec changes, verification files, package APIs, or historical evidence.
- No implementation of currently blocked, deferred, or live-pending stories.

## Decisions

### Use six stable product domains

Use A Accounts, B Payments/Transfers, C Assets, D Contracts, E Transactions, F Integrations, and X Appendix. X Appendix contains remaining deferred and cross-cutting material; F Integrations contains shared UI and onboarding integration work. These describe durable product responsibilities rather than development chronology and consolidate the previous fragmented Admin, UI, Game Economy, Security, and Spike categories.

### Use explicit wallet lanes

Within each applicable domain, use `P` and `G` headings for Player Wallet and Game Wallet. Use `P/G` for genuinely shared behavior and a neutral marker for Admin, spike, or cross-cutting work. This avoids forcing a story such as shared toast presentation or a game-economy boundary into a single wallet owner.

### Keep new IDs documentation-facing

The new IDs identify user-story scope and navigation only. Runtime selectors and account-selection identifiers remain unchanged. A mapping table in the documentation preserves the relationship between former IDs and new IDs.

### Make documentation authoritative for Admin labels

The Admin navigator and tests will consume the same catalog definitions or an equivalent single source of truth so that category names, IDs, lane labels, and ordering cannot drift. Existing implemented-only and disabled-action guards remain in force.

### Preserve historical status

Each moved story carries its current status, including complete, partial, blocked, deferred, and live-pending. Renumbering is not evidence of delivery.

## Risks / Trade-offs

- [Risk] External notes and links may still use old IDs -> Mitigation: include an old-to-new cross-reference and preserve historical paths.
- [Risk] A broad Admin rewrite could accidentally expose planned stories -> Mitigation: keep the existing implemented-demonstration filter and add catalog/status tests before changing labels.
- [Risk] Some stories span both wallets -> Mitigation: permit `P/G` and document the actual operation boundary instead of duplicating stories.
- [Risk] Existing OpenSpec requirements contain old IDs -> Mitigation: update only current documentation-facing references where scoped, while retaining archived requirements and recording the mapping.
