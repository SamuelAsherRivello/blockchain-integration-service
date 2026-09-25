## Context

See proposal.md for motivation and confirmed scope. The current context has only view/hasProfile state, throws on active-profile opening, and resets transient state synchronously. There is no implemented Arkade adapter. The installed SDK is a starting point, not evidence that all required Signet operations work. Existing main specs describe A1; this change supplies deltas rather than retroactively altering its completed artifacts.

## Goals / Non-Goals

**Goals:** Preserve the public factory architecture; make production account lifecycle and persistence identical for a game host and the demo; keep secrets outside host-visible state; prevent stale async work from reviving a reset account.

**Non-Goals:** No separate demo wallet, cross-origin account sharing, production custody claims, unlock/password UX, recovery import, functional logout, wallet transactions, funding, balance, or full A4 menu. A3/A4/A6 need not be implemented in numeric order.

## Decisions

### Production-owned workflow

Core owns loading, logged-out, creating, recovery, persisting, active, and error states. UI owns presentation, including the private recovery view. Arkade owns SDK-specific identity creation, serialization, connectivity, and cleanup. The public immutable snapshot exposes only safe account/view/operation status and an opaque stable profile identifier. Recovery material is available only through a private UI path, never a public state subscription or game event. Preserve existing factory entry points; add initialization/readiness and creation actions without leaking SDK types. Hydration must finish before deciding whether creation is allowed.

Creating displays the rotating-and-pausing lightning loader. Recovery is shown immediately after successful creation. Continue is proposed to be enabled without a mandatory backup checkbox; it becomes disabled while saving. Commit persisted identity before publishing active state and accountConnected. Repeated actions are idempotent while pending. Hydration publishes safe current account state, not a claim that a new account was created or that network operations are available.

### Persistence and interruption

Persist only after Continue; until then the new identity remains transient, including any SDK backing store. Refresh/disposal before commit abandons this flow and the next entry starts logged out. Once the commit completes, the account is active even if refresh occurs before the success screen is painted. A failed commit retains the transient identity and offers Retry or Back without claiming a remembered login. Navigating Back from an unfinished flow abandons it; it does not persist or activate an account.

Proposed storage design: integration-namespaced IndexedDB with a versioned Signet record, a stable profile identifier, and encrypted serialized identity. Use browser Web Crypto with a non-extractable key stored by that origin; no user unlock step. This is protection against casual plaintext inspection, not protection against same-origin script compromise. Do not claim password-grade protection or secure erasure. Validate SDK serialization and browser support before implementation. If this design cannot satisfy the required behavior, revise the proposal rather than silently changing persistence, adding an unlock flow, or storing a plaintext phrase.

Memory-only and tab-only persistence were rejected by the user. Resuming an unfinished recovery screen was rejected in favor of restarting creation. Automatic login is origin/browser-profile local; the game and demo share behavior, not necessarily the same stored account across different origins.

### Returning account and story entry

A2 selection opens the production Account dialogue through the public API. With no account, it presents Create/Restore/Back; the player explicitly starts creation. With a saved account, it shows the same minimal active dialogue used after A2.10: Account, "You are now logged in.", disabled lightning-prefixed Log Out, and Back. Hide Create/Restore. This supersedes the earlier standalone "already logged in" suggestion. Back restores preceding presentation, including an empty layer for direct A2 entry. A1 retains its entry-button demonstration and uses the same state-aware production dialogue.

### Reset, disposal, and failures

Reset Client is a deliberate first-run reset and becomes asynchronous if persistence requires it. Invalidate in-flight work, clear only integration-owned account material/caches/key, dispose old handles, clear selection, and recreate clean handles. Late completion must neither write credentials nor emit activation. Ordinary unmount/disposal does not erase committed identity. Reset remains reachable when a saved account exists but no story is selected. Other tabs must invalidate obsolete account state after reset; use an origin-scoped reset generation/notification with a storage transaction check before commits.

Under the repository's database-safety rule, the agent must not execute destructive database operations during implementation or verification. Any required manual deletion-based reset verification must be handed to the user; do not bypass the rule with alternate APIs.

Storage unavailable/corrupt/unsupported-version is a visible account error, not automatic replacement of the account or a false logged-out state. Preserve the record until explicit reset. SDK/connection failure offers Retry or Back; sanitize errors. Account identity can remain remembered offline; network unavailability is separate from logged-in status. No success means funded, payment-capable, or online. No automatic retries that create multiple identities.

### Verification checkpoint

Before wallet implementation, inspect the installed SDK and current official documentation for Signet configuration, browser creation, recovery format, identity reconstruction, persistence side effects, and cleanup. Record evidence and version in this design. Verify Signet network validation and fail closed for another network. Do not substitute a fake wallet or widen provider/network scope if blocked. This checkpoint is intentionally uncompleted planning work, not a verified feasibility claim.

## Risks / Trade-offs

- Same-origin compromise can access an automatically unlocked identity -> test-only warning, strict secret boundaries, no secret-bearing telemetry or screenshots, and no production security claims.
- SDK persistence before Continue could violate restart semantics -> use transient SDK storage and validate side effects at the checkpoint.
- Reset racing async creation or another tab -> generation checks, coordinated invalidation, and stale-result tests.
- Browser storage may be unavailable or evicted -> truthful failure, external phrase saving remains optional, no guarantee beyond retained origin data.
- Storage clearing loses access if the phrase was not saved -> Reset is explicitly a first-run operation; it does not erase remote wallet assets.
- Signet infrastructure may not support the planned API -> stop wallet implementation and revise the affected artifacts with evidence.

## Migration Plan

There is no existing implemented wallet record to migrate. Introduce a versioned namespace; refuse unsupported records without overwriting them. Update the demo and documentation with the integration release. A rollback may disable A2 via an additive fix while retaining stored account data; it must not silently reset users. Do not rewrite Git history or completed A1 artifacts.

## Open Questions

Exact SDK calls/endpoints and compatible recovery encoding are evidence to record at the checkpoint. If the evidence requires changing the specified user behavior or storage approach, return to planning. Loader timing and final sanitized error copy can be settled during implementation without changing the contract.

## Implementation evidence (2026-09-03)

- Installed SDK 0.4.67 and its declarations/README were inspected. The current official [wallet guide](https://docs.arkadeos.com/wallets/getting-started/create-your-wallet) documents MnemonicIdentity and requires isMainnet:false for test networks. The [operator list](https://docs.arkadeos.com/wallets/getting-started/developer-resources) lists the active Signet endpoint.
- The live /v1/info endpoint returned HTTP 200 and network=signet. A genuine SDK wallet was created with explicit InMemoryWalletRepository/InMemoryContractRepository, a test-network mnemonic identity, and a tark1 address, then disposed. No recovery text or private key was recorded.
- The general online storage guide describes older adapter defaults; installed 0.4.67 types explicitly default to IndexedDB. Implementation therefore explicitly provides memory repositories and never relies on defaults.
- Browser verification proved a 12-word recovery view, optional-saving Continue, no remembered identity after refresh before Continue, committed identity hydration after reload and browser restart, disabled Log Out, Back, and preview scaling. The plain-host fixture recognized the same origin-local account without demo dependencies.
- Encrypted AES-GCM identity with a non-extractable browser key survives persistent-profile browser restart. No plaintext identity is written by BIS; SDK wallet instances are disposed after validating creation. Hydration reconstructs the mnemonic identity offline to verify the stable public-key-derived profile identifier; opening a remembered account does not promise network availability.
- Browser endpoint: http://127.0.0.1:5175/ (5173 and 5174 were occupied). The only observed console resource error was the existing missing favicon. Runtime bundle is roughly 1 MB minified and triggers Vite's size warning; no runtime failure was observed.
- Real persisted-data Reset Client execution remains a manual verification task under repository database rules. Test doubles verify reset success/failure, interrupted work, and cross-instance invalidation; no live database deletion was executed by the agent.

### Recovery clipboard addition

The user requested Copy to Clipboard above Continue. Production UI calls navigator.clipboard.writeText only on explicit click, normalizing words to single-space-separated plain text. Local feedback reports success or retry/manual-copy failure without logging the phrase or forwarding it to Core/public events. A3 should accept the same format and may add Paste from Clipboard when restoration is implemented. Browser verification used a clipboard-writer test double to avoid touching the system clipboard.
