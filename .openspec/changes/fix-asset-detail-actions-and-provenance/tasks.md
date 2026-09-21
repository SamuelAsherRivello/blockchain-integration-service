# Tasks

## 1. Asset identity and provenance

- [ ] 1.1 Extend the JSON-safe public asset type with optional source transaction and source operation identifiers, preserving compatibility for generic and external holdings; verify existing asset API type and serialization tests remain green.
- [ ] 1.2 Hydrate provenance only from an authoritative same-account, same-network mint or wallet-history record and leave ambiguous or unavailable values absent; verify fixtures prove no name/ticker-based inference and no secret or raw SDK data is exposed.

## 2. Detail presentation and action wiring

- [ ] 2.1 Update the shared asset-detail formatter and copy report to include full Asset ID, exact quantities, metadata, active network, network-correct Explorer URL, icon URL, and optional provenance in stable labeled order; verify long identifiers remain selectable and `Not available` is used for missing values.
- [ ] 2.2 Pass the active verified network and selected asset through one detail view model used by both the report and actions; verify Signet and Mutinynet URLs cannot cross-route and stale selection/account callbacks are ignored.
- [ ] 2.3 Separate Explorer disabled state from Burn availability, preserving the existing confirmation, exact-quantity, durable-intent, duplicate, and unknown-outcome guards; verify missing Explorer/provenance disables only Explorer and valid Burn submits once with the selected base-unit quantity.

## 3. Regression coverage

- [ ] 3.1 Extend Account Assets browser-host coverage for the Level 3-shaped holding, full identity/provenance copy output, external asset with unavailable provenance, valid/invalid IDs, and narrow-host selectable fields; verify no fabricated transaction or operation identifier appears.
- [ ] 3.2 Add deterministic Signet and Mutinynet action tests, including safe `window.open` arguments, Explorer disabled reason, Burn remaining enabled, account/network change invalidation, and duplicate-click protection; verify the expected URL and exact burn request.
- [ ] 3.3 Add or update integration tests for known BIS mint provenance, missing provenance, provider mismatch, and unknown burn outcomes; verify no confirmed success or duplicate submission is inferred.

## 4. Validation and handoff

- [ ] 4.1 Run focused asset, burn, and demo tests plus `npm.cmd run typecheck`; verify all new scenarios pass without changing unrelated dirty files.
- [ ] 4.2 Run `npm.cmd run build`, `git diff --check`, and `openspec validate --change fix-asset-detail-actions-and-provenance --strict`; verify the proposal, three delta specs, design, and tasks are complete and only planning artifacts were added in this proposal phase.
