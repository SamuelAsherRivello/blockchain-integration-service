## Context

See proposal.md for motivation. The existing integration context owns account lifecycle and balance reads, and the demo invokes its public methods. Achievement methods must work even when createBisUi is never called. The current story document's opportunity/Claim/Account-list flow is superseded for this slice by direct player-wallet issuance and a host-owned result display.

Installed @arkade-os/sdk 0.4.67 declarations expose assetManager.issue with bigint amount and immutable metadata, issuance results containing assetId/arkTxId, getBalance asset holdings, and getAssetDetails. The official [asset guide](https://docs.arkadeos.com/wallets/operations/assets/get-started), checked 2026-09-03, documents issuance and balance queries; local installed types take precedence over examples that use numeric amounts. This proves API availability, not successful operation against https://signet.arkade.sh. A funded issuance, fresh metadata/list query, and same-identity restoration are the first implementation gate; do not substitute mocks for that evidence.

## Goals / Non-Goals

**Goals:** A small public API independent of rendering, wallet-derived ownership, conservative handling of repeated/uncertain submissions, and an Admin host demonstrating exactly that API.

**Non-Goals:** A trusted award authority, cryptographic proof of gameplay, global exactly-once issuance across unrelated browsers/devices, transfers, burning, issuer infrastructure, or a general payment/recovery dashboard. Duplicate protection covers currently owned achievements and locally known pending submissions; lifetime single-award policy after an external transfer remains outside this slice.

## Decisions

### Public contract and separation

Proposed additive methods on BisContext: earnAchievement(achievementId: string) and listAchievements(), returning promises of discriminated JSON-safe results. An achievement record contains achievementId, assetId, and quantity as a decimal string. Earn success returns status earned or already-owned, profileId, and the record; new issuance may include a generic transactionId. List success returns status success, profileId, and achievements. Errors use status error, a stable code, a safe message, and profileId when known. Codes cover account-required, invalid-input, insufficient-funds, unavailable, outcome-unknown, account-changed, disposed, and unsupported-environment. Export no SDK types or bigint values.

Core validates and snapshots the active account, coordinates calls, and maps errors. The Arkade adapter owns secret access, live Signet checks, wallet lifecycle, metadata and issuance. Admin consumes public results only. Existing UI state stays unchanged; achievement failure must not put the Account flow into its global error phase. Compared with an overlay-driven API, this permits a headless host and leaves presentation with the game.

These API names and result shapes are proposed engineering choices. Confirmed product choices are player-wallet issuance, no runtime achievement UI, already-owned handling, account-required errors, and Admin-only controls/output.

### Asset representation and recognition

Issue amount 1n with no controlAssetId and metadata containing name equal to the exact caller string, decimals 0, bisKind equal to achievement, bisSchemaVersion equal to 1, and bisAchievementId equal to the exact string. Preserve literal backticks in the confirmed demo argument: ``achievement-`level-one` ``. Reject whitespace-only input rather than silently changing identifiers.

List positive wallet asset holdings and fetch their immutable details. Recognize only the supported BIS marker/version and a valid identifier; return records sorted by achievementId then assetId for stable output. Exclude unrelated or unsupported metadata. A required metadata request failure fails the list rather than silently omitting potential achievements. Never render metadata as HTML or automatically fetch icon URLs. Metadata recognition supports clean restoration without a local asset catalog, but is not proof of a trusted issuer: player-wallet self-issuance is deliberately forgeable. Prefix-only recognition and browser-only success flags are rejected.

### Funding and live reads

The current player's wallet supplies any required sats. No automatic funding, hidden secondary wallet, or balance seeding. Map insufficient funds to a public error; obtain actual requirements from the configured operator/SDK instead of assuming a fixed cost. Use fresh wallet state and guard against the SDK returning a cached repository after a provider error, as the balance adapter already does. A successful zero/empty result requires successful live reads. Reuse bounded temporary-wallet acquisition and cleanup, but audit transaction cleanup carefully: disposing a wallet or aborting a caller must not imply rollback of a submitted transaction.

### Duplicate and uncertain-outcome protection

Serialize issuance per profile across same-origin contexts/tabs with Web Locks; if unavailable, refuse issuance safely rather than degrading to duplicate-prone behavior. Check current holdings inside the lock and return already-owned on a matching identifier. Use a small BIS-owned non-secret operation journal keyed by network, profile and achievement to record intent before invoking issuance and append outcome records afterward. Store only public operation identifiers/status, never wallet credentials. Failure to persist the initial intent prevents submission.

After reload, a prior unresolved intent triggers reconciliation, not resubmission. A matching owned asset resolves it; a known transaction can be checked through supported SDK/indexer state. Only a positively established pre-submission/definitive failure permits another issue attempt. If the outcome cannot be proven, return outcome-unknown even when holdings are empty. This favors avoiding duplicates over automatic recovery. Keep public journal entries across account logout/reset; they neither reactivate accounts nor establish ownership. Account switching prevents additional submissions and results remain tagged to their originating account. Same-origin serialization cannot guarantee atomicity between unrelated devices or survive user-cleared browser storage; document that limit.

### Admin composition

C1 is a styled noninteractive story container with one native Earn button; do not nest buttons. C4 is a View Achievements button. Preserve the current disabled-story behavior during an open Account flow. C1/C4 invoke the production context directly instead of the preview navigation handler; no selection should mount or clear preview content. Disable a pending action to discourage repeated clicks, while core still protects direct callers.

Place Admin Console below story controls, always mounted. Append an operation label, pending state, and serialized public response; catch unexpected errors with sanitized output. Use a scrollable text region with a bounded transient history (proposed 100 entries). Clear history on refresh/Reset Client and ignore late completions from an earlier reset generation. Old entries may remain after ordinary logout but must retain their account label. No persistence, raw SDK logging, or extra console tools are needed.

### Story reconciliation

Update C1/C4 diagrams during implementation with stable existing step IDs and explicit superseded/deferred annotations. C1 now earns directly; C4 returns data without Account navigation. C2's separate Claim UI is deferred, while duplicate/error handling required here is not deferred merely because C3 exists. Keep B and C5 out of scope. D1 is documentation only: a game-controlled wallet/issuer may replace player issuance later and needs more specification. Do not add a D Admin category or fully specify its design now.

## Risks / Trade-offs

- [Signet issuance or metadata support differs from the installed API] -> verify the funded round trip first; report a blocker instead of simulating delivery or adding an issuer server.
- [Interrupted calls have ambiguous submission status] -> durable public intent and conservative outcome-unknown; never infer failure from absence alone.
- [Self-issued metadata can be forged] -> describe this as a demonstration, with trusted issuance deferred to D1.
- [External transfers or simultaneous independent devices defeat lifetime uniqueness] -> promise current-ownership checks and same-origin serialization only; no transfer feature or global award registry in this slice.
- [New public records outlive logout] -> store public reconciliation data only, isolated by profile/network; never restore account access from them.

## Migration Plan

Add public methods without changing existing Account methods or stored credentials. Introduce a separate versioned public journal; no destructive migration is required. Implement and verify the adapter/core before adding Admin controls. Retain existing A-story pending evidence. If support fails, leave C1/C4 undelivered and existing Account behavior intact; any rollback uses additive changes and preserves issued assets and journal records.
