## Context

See proposal.md. Generic public APIs and Admin controls already exist. The installed SDK is pinned to 0.4.67, and packages/integration/src/arkade/assets.ts already calls wallet.assetManager.issue with bigint supply, metadata, and no controlAssetId. The task is to complete this BIS path using the working external mint as a reference.

### User-supplied Signet evidence — 2026-09-04

The user reports restoring the same identity in [Arkade's Signet wallet](https://signet.arkade.money/), minting the intended Level 1 asset there, and then listing it successfully in BIS. Screenshot 1 shows Asset minted; screenshot 2 shows its holding, metadata, supply 1, and decimals 0. The supplied BIS Console response gives the full public identifiers:

| Field | Supplied value |
| --- | --- |
| profileId | `38a45d3d35c367c1d19f4d93d8231acd73ce36d98cb0576b31a387ebc87ce803` |
| assetId | `7de59891e1cdcb9292800aff0597b92e8e01ad95821711fccba6b84744ed948b0000` |
| quantity | `"1"` |
| name | `Achievement: Level 1` |
| ticker | `LVL1` |
| decimals | `0` |
| iconUrl | `https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-1-trophy.png` |

Store the icon URL as the plain URL, not the Markdown link wrapper in the pasted message. Control Asset None remains the requested mint configuration; the screenshots show the resulting asset rather than that input field. These are user-supplied observations, not a mint or fresh wallet read performed during this planning revision. They establish external Signet issuance and BIS nonempty ownership interoperability for this identity at the time of the report; they do not prove BIS issuance, current spendability, or the status of an older transfer.

The supplied List Assets pending entry is followed by success for the same profile. App.tsx emits that pending label before awaiting the read; it is not a durable transaction or a recovery blocker. Older funding and registered-transfer observations in C1_C4_VERIFICATION.md remain dated evidence and do not override this newer report.

## Goals / Non-Goals

**Goals:** Successful BIS issuance of another asset for the reported identity, fresh discovery of both old and new holdings, exact quantities, and retry safety through the existing generic API and Admin controls.

**Non-Goals:** Game accomplishments or eligibility, trusted issuer verification, transfers to another wallet, control assets, reissuance, burning, sat payouts, or any production asset overlay. Reference-screen actions do not expand the requested feature set. Broad pending-transfer recovery/cancellation and independent-spending policy belong to their existing separate changes.

## Decisions

### Complete the existing SDK mint path

Use [Arkade's public wallet source](https://github.com/arkade-os/wallet) and the Signet app as implementation references. During apply, identify the relevant source revision and available deployment/SDK versions, compare its no-control-asset issue flow with BIS, and record any mismatch. A repository branch alone is not proof of the exact deployed Signet version. Adapt relevant orchestration through the existing BIS adapter and generic API; do not embed the external wallet UI or implement a separate issuance protocol. Retain the pinned SDK unless a demonstrated incompatibility requires a separately justified dependency change.

Trace Admin form → public context → wallet guard → asset adapter → SDK issue → provider submission/finalization → returned result → fresh ownership read. Current comparison points are Signet provider configuration, eligible funding/input selection, amount and metadata mapping, temporary repositories, settlementConfig false, the 30-second deadline, durable submission records, and success/finalization handling. These are inspection targets, not diagnosed faults. Existing adapter metadata maps iconUrl to the SDK icon field and adds BIS operation metadata for reconciliation.

The earlier busy result occurred before the adapter submitted. Reproduce any current failure and identify its stage before attributing it to the SDK, Signet, funding, or an old transaction. Fix proven mint-specific failures and exercise the real adapter with provider-boundary tests; mocked public-context success does not verify SDK submission or completion. Keep automatic funding and automatic settlement disabled.

### Separate mint delivery from pending-transfer recovery

Use the current shared wallet-operation policy, including input reservations and active mutation locks. The main asset-api spec already permits independently funded mints only when disjoint inputs, including fee inputs, can be enforced. This change must not restore the older blanket rule that every unresolved transaction blocks all new mints. Implementation of general reservations/recovery remains in unblock-independent-wallet-operations and related transfer changes.

If a fresh check shows an actual conflicting input, an unresolved record with unknown inputs, or unavailable shared-policy support, report the precise dependency and stage. Continue mint-path comparison and isolated verification; do not relabel the working external mint or list as unsupported. No mint action clears recovery records, cancels transfers, bypasses conflicting-input safeguards, or changes the account. A different-wallet success may supplement testing but cannot stand in for the requested same-identity acceptance.

### Admin presentation

Retain the existing large in-page modal titled Mint Asset, centered over the demo with its own backdrop. Admin owns it; it is never mounted through createBisUi or inside Runtime Preview. This preserves the same context and console and avoids popup/session synchronization. On narrow screens it fits the viewport and scrolls vertically.

Match the reference's dark surfaces, rounded inputs, generous spacing, asset summary, Unverified badge, and purple Mint action. Name/Amount use the wide column; Ticker/Decimals use the narrow column; Icon URL spans the form. Back and Escape dismiss while idle and return focus to Mint Asset. Trap focus and label the dialog and validation messages. After submission, fields and dismissal are disabled until a result or bounded timeout; browser closure still does not imply cancellation.

Defaults: Name is "an asset", Ticker is "ASSET", Amount is "1", Decimals is "0", Icon URL is empty. The summary is a local form summary, not proof of wallet ownership. Display a neutral initial/avatar; store an optional icon URL as metadata without fetching it in this slice. Control Asset is a read-only None field; do not offer Existing or New. The public request has no controlAssetId field.

Retain three quick-fill buttons above the fields: Achievement: Level 1, Achievement: Level 2, and Achievement: Level 3. Each sets that exact name and respectively LVL1, LVL2, or LVL3, with amount "1", decimals "0", the matching hosted numbered trophy icon URL, and None. These agreed example values remain editable. Presets make no API call, do not mint, and are disabled while submitting or reconciling an immutable pending request. Preset data belongs only to integration-demo; the BIS API treats the values as ordinary strings.

Name and ticker are required nonblank strings, preserved as entered; proposed limits are 128 and 16 characters. Decimals is an integer 0-18. Amount is a positive human-readable decimal string with no exponent, signs, or excess fractional places. Convert exactly with string/BigInt arithmetic to base units, within the supported unsigned 64-bit supply limit. No floating-point conversion or silent rounding. Optional Icon URL accepts only absolute HTTPS URLs without credentials; render metadata as text. Validate SDK/operator limits in the feasibility task and reject unsupported values explicitly.

### Public API

Proposed methods: mintAsset({ operationId, name, ticker, amount, decimals, iconUrl? }) and listAssets(). Inputs/results are JSON-safe; amount and quantity are strings. Mint result: status minted or already-minted, operationId, profileId, asset, and transactionId when known. List result: status success, profileId, assets. Asset records expose assetId, base-unit quantity, and optional name/ticker/decimals/iconUrl. An asset with absent metadata remains in the list.

Errors use status error, a stable code, safe message, profileId and operationId where known. Codes include account-required, invalid-input, insufficient-funds, unavailable, outcome-unknown, account-changed, disposed, unsupported-environment, and busy. No SDK types or secret-bearing exceptions cross the API boundary. APIs never open account or asset UI and never change account navigation state.

### Supply and ownership

Issue the exact converted amount, omit controlAssetId, and set supplied generic metadata. Add a versioned BIS operation marker solely for restoration/retry reconciliation; do not use game names, accomplishment IDs, or achievement filters. List every positive owned asset, fetch its details, and sort by assetId. A failed required read fails the query rather than returning an empty or partial collection. Guard against SDK cached fallbacks after provider failure. Optional missing metadata is valid.

No control asset means this mint supplies no reissuance authority. Separate intentional mints may share names/tickers; each creates a distinct asset ID. Names are not unique identifiers or proof of a trusted issuer. The Unverified badge must not suggest external validation exists.

### Submission and recovery

Serialize wallet mutation using the existing same-origin wallet lock shared by transfers and account clearing. A non-secret durable journal is keyed by network/profile/operationId and binds the ID to the complete normalized request. Reject reusing an operation ID with different inputs. Before network submission, persist intent; failure to persist prevents submission. Latch submission at the provider boundary and prevent late pre-submission work after timeout/account replacement/disposal from submitting.

A repeated successful operation returns already-minted using the known asset. An uncertain operation reconciles fresh owned metadata and available transaction information before any replay of that operation. An empty list alone does not prove failure; return outcome-unknown if no definitive answer is available. A new operation ID cannot bypass conflicting or unknown reserved inputs. Independently funded new operations follow the shared policy described above. The modal retains the operation ID/request for retry; refresh recovers the unresolved request from public journal data. A separately initiated mint after success receives a new ID even if its fields match. The externally minted Level 1 asset has no BIS operation marker and must never satisfy a new BIS operation merely by matching name/ticker. Minting does not clear journals; retention and explicitly acknowledged logout cleanup follow the current account lifecycle contract, without redefining it here.

Fresh restore/list does not rely on a local asset catalog. Account generation checks prevent stale responses being attached to a different account. Bounded temporary-wallet cleanup does not imply transaction rollback. Same-origin locking cannot guarantee cross-device exactly-once behavior; document this limit.

### Console and verification

Use the existing Console region for Admin Console output, always mounted. Entries label operation/profile and show pending plus JSON-safe API results or sanitized failures. Keep up to 100 transient entries; clear on refresh or successful Reset Client; ignore results from a previous client generation. Request-level pending ends with that request's returned result; it is distinct from a submitted mint with an unknown outcome. Read-only listing must not create a mint/transfer journal or reserve funds. Neither list nor mint selects a preview story. Existing account-flow restrictions remain.

Acceptance uses the reported identity and the agreed Level 1 preset:

1. Fresh C4 List Assets rediscovers the external asset above with quantity "1" and matching metadata. Keep the asset owned and unchanged throughout the test.
2. Open C1, select Achievement: Level 1, keep amount "1", decimals 0, the hosted icon URL and Control Asset None, and explicitly Mint with a new operation ID. BIS must return minted with a new asset ID different from the external asset, rather than claiming already-minted from matching metadata.
3. Fresh C4 List Assets must return both distinct asset IDs, each quantity "1" with the expected metadata. Record the public operation ID and transaction ID when available. A submitted-only response, stale form summary, or external-wallet screenshot is not BIS mint acceptance.
4. Retry the completed BIS operation ID with the same inputs; it must identify the original BIS asset and create no additional issuance. Verify a separately initiated mint receives a new ID, without automatically submitting it.
5. Use fresh SDK wallet repositories for the same identity to rediscover both holdings without a local asset catalog or exposing recovery material. Retain any unperformed manual restoration checks as pending.

Keep fixture/provider tests, user-supplied observations, and newly performed live checks separately labeled. No build/test result or planning update marks the still-unperformed BIS mint acceptance complete.

## Risks / Trade-offs

- [BIS configuration or completion handling differs from the working reference] -> compare the actual SDK/provider path, then verify the same-identity mint/list round trip; no assumed root cause or simulated success.
- [Funding or conflicting inputs changed since the user's mint] -> recheck fresh eligibility and report the precise shared-policy dependency; old screenshots or journals do not establish current spendability.
- [Ambiguous submission] -> durable intent, same operation reconciliation, and shared conflicting-input protection without blind resubmission.
- [Numeric precision] -> strings and BigInt throughout conversion; boundary tests.
- [Arbitrary metadata] -> safe text, optional icon metadata only, no automatic external requests.
- [Modal adds Admin complexity] -> keep it in the demo and consume public APIs only.

## Migration Plan

Preserve existing APIs, Admin controls, working listing, published trophy files, account behavior, and unrelated uncommitted work. Capture the external holding baseline; compare the reference and current mint path; implement the demonstrated adapter/core/Admin fixes; then perform the live acceptance sequence. asset-api already exists in main specs, so this revision uses MODIFIED requirements and preserves the newer shared input-reservation contract. Update C1/C4 verification and related documentation during apply so historical blockers are not presented as current. No destructive data migration or asset deletion; rollback uses additive fixes and preserves minted assets.

## Numbered trophy metadata follow-up — 2026-09-04

Preset definitions live in integration-demo/src/admin/achievement-presets.ts and are consumed by MintAssetDialog. Their icon URLs use the public base https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/ with level-1-trophy.png, level-2-trophy.png and level-3-trophy.png. Source PNGs live in integration-demo/public/assets/achievements/v1/. Each is 64 by 64 with alpha transparency, using the original Stealth Grid-style trophy pixels outside the numbered area. Only the matching digit appears on the cup. Initial form defaults remain blank for the optional URL; presets remain editable and never mint automatically. BIS continues treating URLs as metadata without fetching images.

Preserve v1 bytes and paths for existing mint metadata. Future artwork uses a new version directory. GitHub Pages availability depends on retaining the repository and deployment; this is stable hosted metadata, not a guarantee of decentralized permanent storage. The trophy-assets-v1 GitHub release also contains the PNGs.
