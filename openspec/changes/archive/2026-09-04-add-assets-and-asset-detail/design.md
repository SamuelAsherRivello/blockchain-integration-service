## Context

See proposal.md and the delta specs for the observable contract. AccountActivity.tsx and ui/client.tsx provide transaction navigation; overlay.css supplies bounded 480px cards. The later user iteration authorizes Transactions naming, three-line rows, metadata artwork, inline metadata copying and confirmed Burn.

core/assets.ts already exposes BisAsset with assetId, base-unit quantity as a string, and optional name, ticker, decimals, and iconUrl. core/context.ts listAssets returns a UI-independent result. arkade/assets.ts obtains fresh positive holdings and metadata, sorts by ID, and rejects failed reads. Total supply and verification are not exposed. This is code inspection, not fresh live Signet verification; the apply phase must verify the read-only path in the current runtime.

## Goals / Non-Goals

**Goals:** Add a reusable account-owned inspection flow while keeping caller-owned API reads separate from presentation reads. Preserve precision, bounded requests, accessible navigation, and existing account lifecycle behavior.

**Non-Goals:** A general router/list framework, issuance repair, partial-quantity burn forms, asset transfer/reissue, or invented supply/verification data.

## Decisions

### Account state owns the asset session; React owns local navigation details

Add accountAssets and a provider-neutral asset-load state to BisState, with openAccountAssets() and refreshAssets() on the public context, following the existing account presentation conventions. The load state distinguishes idle, loading, ready, and unavailable. Reuse the existing listing work through a shared internal read path without making listAssets() update UI state. Alternatives were React-only ownership reads or overloading listAssets with navigation; the former makes lifecycle invalidation harder to coordinate, and the latter breaks Admin/API isolation.

Within the asset component retain the selected asset ID, detail-open flag, list scroll offset and row references. Selection is by ID, never name or object identity. The dialog heading and refresh affordance follow detail navigation, as Activity already does. Clear the asset session on leaving Assets for Account, replacement/logout/reset, UI unmount and disposal. Keep detail-to-list Back within the same session.

Use a presentation/request generation in addition to the account generation. A newer refresh or departure invalidates earlier responses even if the account did not change. Cancel presentation work where supported and independently ignore late completions. UI unmount invalidation must not abort unrelated caller-owned listAssets work.

### Refresh owns a fresh snapshot

Entry from Account and manual Refresh initiate one bounded read; detail entry and detail Back reuse the current snapshot. No polling or persisted snapshot. At refresh start, clear asset records and copy status but retain the selected ID and list navigation context. Use a presentation deadline of at most 30 seconds; provider cleanup must not hold the loading UI open. Surface safe unavailable output on timeout.

On success resolve the selected ID against the new snapshot. Missing selection returns to the list with the specified notice. Failure leaves the detail shell retryable without previous holdings; Back returns to the list's same unavailable state. After retry, restore the detail if the ID exists. This costs a full-list refresh instead of a detail endpoint, but avoids introducing an unverified API and keeps quantity/metadata consistent.

### Asset-specific presentation on the existing dialog pattern

Use dedicated asset row/detail components and the existing button, CopyFieldLabel, and bounded card conventions. Reuse or minimally generalize CSS where useful; do not force assets and transactions into a new abstract component. Use a structured detail layout rather than the transaction report text area because metadata benefits from labels and a quantity summary.

```text
Account --> Assets --> Asset Detail
           ^   |        |      |
           |   +--Back--+      +-- Refresh: resolve same ID
           +-- Refresh list

+---------------------------------------+
| Assets                      [Refresh] |
| Account ID: abcd...1234   Signet       |
| [icon] Achievement: Level 1           |
|        1 LVL1          7de5...0000     |
| [more owned assets; list scrolls]     |
|                                [Back] |
+---------------------------------------+

+---------------------------------------+
| Asset Detail                [Refresh] |
| Account ID: abcd...1234   Signet       |
|                [icon]                 |
|                1 LVL1                 |
|         Achievement: Level 1          |
| Asset ID                       [Copy] |
| full selectable asset ID              |
| Name             Achievement: Level 1 |
| Ticker                           LVL1 |
| Decimals                            0 |
| Details                        [Copy] |
| [Burn]                               |
| [Back]                               |
+---------------------------------------+
```

Keep controls reachable in the 9:16 preview and short containers. Heading focus moves on page changes; Back restores row and offset. Missing selection focuses the list heading. The reusable native confirmation dialog contains focus, starts on Cancel, restores prior focus and treats Escape as Cancel. Its position follows the runtime host.

### Exact formatting and inert metadata

Use string/BigInt decimal placement for supported integer decimals (0-18, matching current mint validation). Unsupported or absent decimals display base units and Not provided in the metadata field. Preserve metadata as text; identical names do not imply identical assets. The neutral icon is local and generic, with no trophy-specific behavior in integration.

The explicit iteration replaces the initial local-artwork default: render HTTPS metadata icons with no referrer and local fallback on invalid or failed URLs. Render metadata as text, never executable markup; do not map asset names to game-specific art. Public listAssets still returns URLs without fetching artwork itself.

Asset ID is a one-line read-only input retaining the full value and its own Copy. Details copies Name, Ticker and Decimals in stable order; failure exposes that text for manual copying. A content/session token rejects stale clipboard feedback.

### Confirmed burn through the existing SDK

Burn snapshots the selected asset ID and exact owned base-unit quantity. OK creates an operation ID and calls the public burnAsset API; Cancel and Escape never call it. Disable Burn, Back and Refresh while submission is active. Success returns to Assets and refreshes; failure retains safe feedback without inventing success.

Core uses existing browser/account mutation locks and pending-send/transfer/mint guards, revalidates the active stored identity, and calls a bounded Signet SDK wallet with automatic settlement disabled. The adapter reads fresh holdings and rejects a changed quantity before calling AssetManager.burn. A per-operation public journal is durably written immediately before submitTx. Completed identical retries return the known result; changed requests are rejected. Lost responses remain pending and block new spends, with logout warning accounting. No automatic burn retry or inferred reconciliation is implemented. SDK-boundary tests exercise the real AssetManager with controlled transport, proving exact amount and preservation of other asset outputs.

## Risks / Trade-offs

- Concurrent account/context changes in this checkout -> inspect current code before apply, add only asset-specific routing and invalidation, and preserve unrelated work.
- Existing main specs contain older Account wording -> the account-entry delta replaces only the asset deferral; later sending, receiving and balance decisions remain authoritative and outside this change.
- Metadata image hosts can fail -> preserve row sizing and fall back to neutral artwork.
- Large lists and malformed optional metadata -> bounded scrolling, safe text rendering, exact quantity helpers, and missing-metadata fixtures; do not truncate the returned collection.
- A live wallet may be empty or unavailable -> fixtures prove interaction states, but record a separate current read-only live result honestly; never mint just to satisfy UI verification.

## Migration Plan

Apply is authorized. Update context/types, adapter, presentation and targeted verification, then docs while retaining C4's console-only contract. Burn uses new per-operation journal keys, without migrating or deleting existing records. Validate real-browser navigation/artwork and isolated burn outcomes, followed by focused tests and build. Never destroy live holdings as a verification shortcut.
