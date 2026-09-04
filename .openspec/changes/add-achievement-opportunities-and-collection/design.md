## Context

See proposal.md. The latest user direction is generic assets at BIS level, an Admin form resembling the supplied Mint Asset screenshot, console output, no Runtime Preview use, and Control Asset: None. The installed SDK 0.4.67 exposes issuance with bigint amount, optional immutable metadata, optional controlAssetId, and asset holdings/details. API availability is not live issuance evidence.

Earlier funding-blocked notes predate the user's reported Arkade balance. Recheck spendable inputs when applying. Two unconnected draft source modules exist from the interrupted implementation; their reward-by-name semantics are superseded here.

## Goals / Non-Goals

**Goals:** A useful generic mint/list public API, exact quantities, real wallet-derived ownership, retry safety, and a richer Admin demonstration.

**Non-Goals:** Game accomplishments or eligibility, trusted issuer verification, transfers to another wallet, control assets, reissuance, burning, sat payouts, or any production asset overlay. Existing account/payment work keeps its scope.

## Decisions

### Admin presentation

Recommend a large in-page modal titled Mint Asset, centered over the demo with its own backdrop. Admin owns it; it is never mounted through createBisUi or inside Runtime Preview. This is preferable to a separate browser window because it preserves the same context and console and avoids popup/session synchronization. On narrow screens it fits the viewport and scrolls vertically.

Match the reference's dark surfaces, rounded inputs, generous spacing, asset summary, Unverified badge, and purple Mint action. Name/Amount use the wide column; Ticker/Decimals use the narrow column; Icon URL spans the form. Back and Escape dismiss while idle and return focus to Mint Asset. Trap focus and label the dialog and validation messages. After submission, fields and dismissal are disabled until a result or bounded timeout; browser closure still does not imply cancellation.

Defaults: Name is "an asset", Ticker is "ASSET", Amount is "1", Decimals is "0", Icon URL is empty. The summary is a local form summary, not proof of wallet ownership. Display a neutral initial/avatar; store an optional icon URL as metadata without fetching it in this slice. Control Asset is a read-only None field; do not offer Existing or New. The public request has no controlAssetId field.

Add three quick-fill buttons above the fields: Achievement: Level 1, Achievement: Level 2, and Achievement: Level 3. Each sets that exact name and respectively LVL1, LVL2, or LVL3, with amount "1", decimals "0", empty icon URL, and None. These guessed example values are editable and can be corrected by the user. Presets make no API call, do not mint, and are disabled while submitting or reconciling an immutable pending request. Preset data belongs only to integration-demo; the BIS API treats the values as ordinary strings.

Name and ticker are required nonblank strings, preserved as entered; proposed limits are 128 and 16 characters. Decimals is an integer 0-18. Amount is a positive human-readable decimal string with no exponent, signs, or excess fractional places. Convert exactly with string/BigInt arithmetic to base units, within the supported unsigned 64-bit supply limit. No floating-point conversion or silent rounding. Optional Icon URL accepts only absolute HTTPS URLs without credentials; render metadata as text. Validate SDK/operator limits in the feasibility task and reject unsupported values explicitly.

### Public API

Proposed methods: mintAsset({ operationId, name, ticker, amount, decimals, iconUrl? }) and listAssets(). Inputs/results are JSON-safe; amount and quantity are strings. Mint result: status minted or already-minted, operationId, profileId, asset, and transactionId when known. List result: status success, profileId, assets. Asset records expose assetId, base-unit quantity, and optional name/ticker/decimals/iconUrl. An asset with absent metadata remains in the list.

Errors use status error, a stable code, safe message, profileId and operationId where known. Codes include account-required, invalid-input, insufficient-funds, unavailable, outcome-unknown, account-changed, disposed, unsupported-environment, and busy. No SDK types or secret-bearing exceptions cross the API boundary. APIs never open account or asset UI and never change account navigation state.

### Supply and ownership

Issue the exact converted amount, omit controlAssetId, and set supplied generic metadata. Add a versioned BIS operation marker solely for restoration/retry reconciliation; do not use game names, accomplishment IDs, or achievement filters. List every positive owned asset, fetch its details, and sort by assetId. A failed required read fails the query rather than returning an empty or partial collection. Guard against SDK cached fallbacks after provider failure. Optional missing metadata is valid.

No control asset means this mint supplies no reissuance authority. Separate intentional mints may share names/tickers; each creates a distinct asset ID. Names are not unique identifiers or proof of a trusted issuer. The Unverified badge must not suggest external validation exists.

### Submission and recovery

Serialize wallet mutation using the existing same-origin wallet lock shared by transfers and account clearing. A non-secret durable journal is keyed by network/profile/operationId and binds the ID to the complete normalized request. Reject reusing an operation ID with different inputs. Before network submission, persist intent; failure to persist prevents submission. Latch submission at the provider boundary and prevent late pre-submission work after timeout/account replacement/disposal from submitting.

A repeated successful operation returns already-minted using the known asset. An uncertain operation reconciles fresh owned metadata and available transaction information before any further submission. An empty list alone does not prove failure; return outcome-unknown if no definitive answer is available. A new operation ID cannot be used to bypass an unresolved mint for the same account: block new mints until it is reconciled. The modal retains the operation ID/request for retry; refresh recovers the unresolved request from public journal data. A separately initiated mint after success receives a new ID even if its fields match. Journal records survive logout/reset and do not provide account access.

Fresh restore/list does not rely on a local asset catalog. Account generation checks prevent stale responses being attached to a different account. Bounded temporary-wallet cleanup does not imply transaction rollback. Same-origin locking cannot guarantee cross-device exactly-once behavior; document this limit.

### Console and verification

Use the existing Console region for Admin Console output, always mounted. Entries label operation/profile and show pending plus JSON-safe API results or sanitized failures. Keep up to 100 transient entries; clear on refresh or successful Reset Client; ignore results from a previous client generation. Neither list nor mint selects a preview story. Existing account-flow restrictions remain.

Acceptance: open Mint Asset, submit a valid form, observe minted with an asset ID, close the modal, click List Assets, and observe that same asset ID and exact quantity in a fresh returned list. Then verify retry of the same operation creates no additional asset. Distinguish this from an intentional new mint. Verify restoration through a fresh SDK wallet derived locally from the saved identity without printing or exporting its recovery phrase, and retain any clean-profile/manual restoration checks as explicitly pending.

## Risks / Trade-offs

- [Signet support or funding differs from the API] -> perform the funded round trip and document actual requirements; no simulated success.
- [Ambiguous submission] -> durable intent, same operation retry, block further minting while unresolved.
- [Numeric precision] -> strings and BigInt throughout conversion; boundary tests.
- [Arbitrary metadata] -> safe text, optional icon metadata only, no automatic external requests.
- [Modal adds Admin complexity] -> keep it in the demo and consume public APIs only.

## Migration Plan

Reconcile the existing draft modules before exposing APIs. Preserve current account behavior and existing uncommitted work. Rename the historical new-capability directory to asset-api in the apply workflow and update the proposal reference before sync/archive. Implement adapter/core, then Admin controls, then real-browser verification. No destructive data migration or asset deletion. Rollback uses additive fixes and preserves public operation records and minted assets.
