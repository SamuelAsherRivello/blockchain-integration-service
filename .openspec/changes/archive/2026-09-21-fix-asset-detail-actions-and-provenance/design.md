# Design

## Context

See proposal.md for the user-visible motivation. The current runtime already has a network-aware `assetExplorerUrl` helper and a generic `BisAsset` listing boundary, but the Account Assets detail formatter omits the asset ID and network and does not receive provenance. The detail action area derives Explorer availability separately from the report, while Burn depends on the context's active account and network guards. Existing burn planning changes already define the deeper provider-routing and uncertain-outcome safety work.

## Goals / Non-Goals

**Goals:**

- Establish one selected-asset view model for the report and both detail actions.
- Keep the public API Arkade-neutral by representing provenance as optional JSON-safe strings.
- Resolve Explorer URLs from the active verified network only.
- Surface locally known mint/source operation and transaction identifiers without making them prerequisites for external holdings.
- Preserve the existing burn safety boundary and make presentation availability independent from optional Explorer/provenance data.

**Non-Goals:**

- Adding a new explorer service, custom transaction lookup endpoint, or server.
- Inferring asset provenance from an asset ID, name, ticker, quantity change, or explorer page.
- Changing burn confirmation, input selection, durable journals, or unknown-outcome semantics beyond wiring the selected asset correctly.
- Adding game-specific meaning to generic assets.

## Decisions

1. **Extend the public asset shape with optional provenance fields.** Add optional `sourceTransactionId` and `sourceOperationId` string fields (or the repository's equivalent names) to the public JSON-safe asset record. The Arkade adapter may populate them from an authoritative wallet-history/mint-record join; external assets leave them absent. This keeps the UI independent of SDK types and avoids a second asset-details request.

2. **Use one formatter input for visible and copied detail.** Update the detail formatter to accept the selected asset plus the active `TestNetwork`, and emit stable labeled lines for identity, ownership, metadata, network, explorer, icon, and optional provenance. The UI, copy path, and test fixture will all use this formatter so they cannot drift.

3. **Use the active context network as the only Explorer source.** Pass the `network` already supplied to `AccountAssets` into both `assetExplorerUrl` and the detail formatter. A valid asset ID with a configured network produces that network's URL; invalid IDs or absent/unsupported network produce no URL and an accessible disabled reason.

4. **Keep action guards independent.** Explorer disabled state depends only on URL construction and its own busy/selection guards. Burn depends on selected holding validity and burn-in-flight state, then continues through the existing confirmation and context API. Optional provenance and Explorer availability must not be included in the Burn disabled predicate.

5. **Resolve provenance conservatively.** Prefer a completed/pending BIS mint record or an authoritative activity record for the same profile, network, and asset ID. If more than one candidate exists or the relationship is not authoritative, omit the field. The UI renders `Not available`; it never displays a guessed transaction or operation identifier.

6. **Test both network variants without live spending.** Extend deterministic Account Assets hosts and formatter tests with valid IDs on Signet and Mutinynet, invalid IDs, known provenance, external assets, and action assertions. Burn tests use the existing fixture stub and verify exact request values and one submission; disposable live assets remain optional.

## Risks / Trade-offs

- [Risk] Mint records may not contain a transaction ID for older or externally created holdings → [Mitigation] keep provenance optional and label it `Not available`.
- [Risk] A stale network or selected asset could open the wrong explorer page → [Mitigation] derive the URL at render/click time from the current context network and invalidate delayed callbacks on account/selection changes.
- [Risk] Expanding the public asset shape can affect fixtures and consumers → [Mitigation] make fields optional, preserve existing fields and serialization, and add compatibility assertions.
- [Risk] Existing network/burn changes may land separately → [Mitigation] keep this change scoped to UI/API wiring and require integration tests to prove the selected network reaches the existing burn path.

## Migration Plan

No data migration is required. Existing stored mint and burn records remain readable; older records simply produce absent optional provenance. Implement the type/adapter changes, update the detail presentation and action wiring, run focused tests and build/typecheck, then validate the OpenSpec delta. Rollback is a code revert of this change; no user or wallet state is modified by the detail report.
