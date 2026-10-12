# Design

## Context

See [proposal.md](proposal.md) for motivation. Current issuance writes `bisSchemaVersion: "1"` and custom metadata through Arkade's byte-oriented transport; public listing decodes those values before Marketplace classifiers inspect individual fields. The catalog currently derives compatibility directly from those fields, and C.G.2/C.G.3/C.G.4 have no metadata-format selection. Metadata on an issued asset cannot be changed, so a change in its shape needs a replacement lifecycle rather than an in-place edit.

## Goals / Non-Goals

**Goals:**

- Establish `0.0.1` as the first immutable, explicit BIS asset format without changing its current metadata payload.
- Make adding a successor format a bounded registry change with an explicit decoder, validator, catalog mapping, and migration declaration.
- Default successor migrations to automatic, durable replacement-and-retirement work when the operator invokes Admin's Upgrade all player items action with the necessary wallet scope.
- Keep Admin capable of inspecting and operating supported historical versions, while all normal BIS game/runtime and Marketplace behavior remains latest-only.

**Non-Goals:**

- Altering metadata of an already issued asset, preserving an asset ID across an upgrade, or creating a chain-side mutable metadata feature.
- Migrating externally created/generic assets, guessing a mapping from display fields, or introducing a hosted migration service.
- Automatically funding wallets, bypassing active-account/signing requirements, or relaxing mint, delivery, burn, or recovery safety.

## Decisions

### 1. Use a dedicated semantic format marker

Add `bisAssetFormatVersion: "0.0.1"` to BIS-managed issuance metadata. Keep `bisSchemaVersion` as historical transport/application metadata rather than reinterpreting it as the compatibility contract. A semantic dotted version is clearer for an operator, independent from opaque byte display in generic explorers, and permits controlled registrations such as `0.0.2`.

The resolver returns a safe discriminated public result: `supported` with version, `legacy-compatible` with effective version, `unknown-version`, `malformed-version`, or `not-bis-format`. The generic holding remains available in every case. The initial legacy resolver recognizes only a complete `0.0.1` metadata shape; it never tries to promote partial/invalid historical metadata based on a name or ticker.

### 2. Centralize version behavior in a registry

Create one integration-owned registry whose entries contain the format version, metadata decode/normalization policy, strict item/trophy/catalog validation, current mint metadata builder, and successor migration declarations. Admin and Marketplace use this public provider-neutral contract; Arkade-specific byte encode/decode stays behind the existing adapter.

This replaces scattered field checks with a single version gate. A generic API remains game-neutral: it reports metadata plus resolution, while the Marketplace-specific entry owns marketplace item validation. Alternatives considered were a per-UI switch statement and a local-storage version catalog. The former drifts as formats grow; the latter cannot identify an immutable external holding after restore.

### 3. Model an upgrade as durable replacement then guarded retirement

An upgrade cannot edit an asset. For each source holding, create a durable migration record keyed by source asset ID, source version, target version, owner profile, network, and deterministic migration operation ID. Its phases are `planned`, `replacement-pending`, `replacement-delivered`, `retirement-pending`, `completed`, and safe terminal/recoverable error states.

The mapping creates a successor-format replacement with the same supported stable identity and exact quantity, delivers it to the current owner, verifies fresh ownership, and only then burns/retires the old holding through the existing guarded burn mechanism. This order favors avoiding item loss. If retirement is uncertain, the old item remains reserved/recoverable and no second replacement is issued. If replacement is uncertain, the original deterministic operation is reconciled rather than replaced. Normal cache invalidation occurs at each confirmed mutation boundary.

### 4. Automatic migration is version policy, enabled by default

Every successor registration names compatible predecessor versions and provides a deterministic mapping. Unless that declaration explicitly sets `autoUpgrade: false`, Admin's explicit Upgrade all player items action begins/resumes eligible migrations for every compatible holding owned by the currently logged-in Player Wallet. The active Game Wallet issues and delivers a separate mapped replacement for each source holding. The action is not a background polling service and normal game/Marketplace browsing never triggers it; it uses existing active owner/issuer wallet scope, mutation coordination, and durable storage. Where those prerequisites are missing, the UI reports migration pending/unavailable and leaves the old holding intact.

The design intentionally makes future format work include the mapping and its opt-out decision. A version cannot become current without declaring how older supported formats are handled. This is preferable to a global boolean because compatibility is directional and a `0.0.2` migration may be safe while a later format may deliberately require manual review.

### 5. Separate Admin compatibility from normal latest-only behavior

Admin receives a selector populated from supported registry versions represented in the active scope and defaults it to the latest. It scopes C.G.2/C.G.3/C.G.4 and Admin-hosted Asset operational views, not the underlying generic ownership snapshot. Unknown/malformed holdings show separately with safe reasons.

Outside Admin, only the latest resolved version is eligible for game selection, equipment effects, Marketplace rendering, checkout, or trading. An older supported holding is migration-required until the operator runs a successful Admin upgrade; an auto-upgrade opt-out remains explicitly version-scoped in Admin. This prevents a new consumer from accidentally applying a new decoder to an old item.

## Risks / Trade-offs

- [Replacement and retirement can temporarily result in two holdings] → Deliver first to avoid loss, reserve/reconcile the old holding, and never issue a second replacement for the same migration record.
- [Automatic migration needs available owner and issuer/funding scope] → Surface a precise pending state; do not simulate, fund, or skip migration safety checks.
- [Legacy detection could misclassify arbitrary metadata] → Require complete strict validation, include an explicit marker in every new asset, and leave uncertain holdings unsupported.
- [Registry additions can diverge across consumers] → Export one version-resolution and latest-policy contract from `@bis/integration`, with cross-package fixtures for every registered version.
- [A future format mapping changes semantics] → Require deterministic mapping tests and an explicit automatic-upgrade decision with the new registry entry.

## Migration Plan

1. Add `0.0.1` registry entry, marker issuance, strict resolver, and compatibility fixtures for existing unmarked `0.0.1` assets.
2. Route generic listing, classification, and Admin filtering through resolution; preserve all generic assets and make non-Admin paths latest-only.
3. Add Admin version selection and format-scoped C.G.2/C.G.3/C.G.4 reporting before enabling a successor migration.
4. Add durable migration records and the replacement-delivery-then-retirement coordinator using existing mint, delivery, burn, reservations, reconciliation, and cache invalidation boundaries.
5. Exercise a `0.0.2` fixture migration from `0.0.1`, including Upgrade all player items completion, independent per-item continuation after an unavailable/unknown result, opted-out, unavailable, interrupted, recovery, account/network change, and duplicate-invocation cases.
6. Before any live migration, report public wallet/network/inventory evidence and require the active local scope. Rollback disables automatic policy for a not-yet-started successor migration; durable started records continue recovery rather than being erased.
