# Design

## Context

The Marketplace currently keeps Game Wallet inventory in component state and derives Player Wallet inventory from the BIS equipment service. Its loading prompt is driven by a single Game inventory flag, while provider failures are converted into empty results in the public inventory path. See `proposal.md` and the two delta specs for the required behavior.

## Goals / Non-Goals

**Goals:**

- Coordinate independent Player and Game Wallet inventory reads.
- Persist only public, classified inventory snapshots for 30 seconds per wallet, role, and network.
- Make selected-tab loading and error feedback independent from the other wallet.
- Preserve existing item classification, ownership labels, checkout operations, and wallet boundaries.

**Non-Goals:**

- No changes to Arkade provider protocols, wallet identity storage, minting, burning, or checkout settlement.
- No cache of recovery material, wallet secrets, raw SDK errors, or transaction payloads.
- No fallback that treats a failed wallet read as an empty inventory.

## Decisions

### One coordinator owns both inventory states

Add a small Marketplace inventory coordinator/hook in the Marketplace inventory layer. It owns two keyed records, `player` and `game`, each with `status`, public items, profile ID, network, `fetchedAt`, and a pending request identity. The UI consumes the selected record and does not infer loading from the unrelated record.

The coordinator starts both eligible reads on refresh. A Player read uses the existing BIS equipment ownership boundary. A Game read uses the existing public Game Wallet inventory lookup and preserves the logged-in address override behavior. Both paths continue to classify chain data through the existing BIS classifier.

### Local cache is public and wallet-scoped

Use one versioned localStorage namespace containing independently keyed records. The key includes role, profile/address identity, and network; the value contains only JSON-safe classified item fields and a timestamp. Invalid, mismatched, expired, or oversized records are discarded. Cache writes are best-effort and never block a live read or expose an exception.

The cache is read before starting a provider request. A fresh record is immediately usable, suppresses the selected tab’s loading prompt, and prevents another provider request for that wallet until expiry or explicit retry. Expired records are not treated as current; a failed refresh produces the selected wallet error state rather than an empty inventory.

### Selected-tab prompt derives from one record

The loading prompt is visible only when the selected role has no fresh usable result and its read is pending. The selected role’s unavailable state renders an error prompt with retry. The other role may remain pending or unavailable without changing the selected role’s prompt. Tab changes only change which record is projected; they do not cancel or duplicate a valid in-flight read.

### Error boundary remains sanitized

The coordinator maps provider failures to a safe public error category and keeps raw SDK errors out of UI state and localStorage. The visible prompt says the selected wallet inventory is unavailable and offers retry. Successful cached items are never replaced with an empty array during a failed background refresh.

## Risks / Trade-offs

- [Stale public data] → Enforce the 30-second timestamp at every read and scope entries by wallet identity and network.
- [Wallet identity changes] → Invalidate the corresponding role’s record when profile/address or network changes; never reuse another wallet’s cache.
- [Cross-tab writes] → Validate cache envelopes on every read and treat malformed or incompatible entries as misses.
- [Provider latency] → Run both reads concurrently and let the selected tab stop waiting as soon as its own result is ready.
- [Private-data leakage] → Serialize only classified public item projections, never BIS account records or error payloads.
