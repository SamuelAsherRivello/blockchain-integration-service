# Design

## Context

See proposal.md for motivation. The current catalog definition in `@bis/integration` supplies family, tier, price, and effect text together, while Marketplace presentation derives Speed, Offense, and Defense from family plus `effectPercent`. Asset metadata validation currently accepts only scalar values, and trophy presets use a separate small metadata shape. Arkade issuance metadata is immutable, so the migration must create new asset IDs after burning the old Marketplace holdings.

## Goals / Non-Goals

**Goals:**

- Make `bisAttributeDeltas` the only gameplay authority for recognized items.
- Use the same BIS-prefixed metadata envelope for items and trophies.
- Preserve catalog identity, equipment-slot classification, pricing, provenance, and native Arkade display fields without treating them as gameplay values.
- Round-trip structured arrays through the generic public asset boundary safely.
- Migrate the nine current Marketplace store assets with explicit burn/remint verification.
- Verify the local game consumes BIS-provided deltas through the provider-neutral public API.

**Non-Goals:**

- Adding control assets, reissuance authority, or a custom server.
- Making the friendly description authoritative or parsing it at runtime.
- Changing the approved nine-item catalog, artwork URLs, prices, or wallet ownership model.
- Treating trophies as gameplay equipment; trophies carry an empty delta array.
- Automatically burning arbitrary assets found in a wallet.

## Decisions

### Metadata shape and authority

Use Arkade native `name`, `ticker`, `decimals`, and `icon` fields, plus BIS custom fields. The item gameplay section is:

```json
{
  "bisDescription": "Increases movement speed by 30%.",
  "bisAttributeDeltas": [
    {
      "bisAttribute": "movementSpeed",
      "bisAttributeDelta": 30
    }
  ]
}
```

Version 1 interprets deltas as percentage points. Missing `bisAttributeDelta` is normalized to zero; new mints write it explicitly. Each attribute may appear once. Trophies use `bisAttributeDeltas: []`.

`bisDescription` is retained for explorer and UI readability, but classification and the game API must use only validated structured deltas. `bisEquipmentFamily` selects the equipment slot and `bisTier` supports catalog display/order and validation; neither supplies a gameplay magnitude.

### Source of truth and public API

The Arkade adapter remains responsible for untrusted metadata normalization and safe JSON serialization. The integration equipment classifier validates the BIS envelope and produces a provider-neutral item model containing the structured deltas. The game-facing API exposes those deltas without Arkade types. Marketplace presentation may use `bisDescription`, but gameplay code must aggregate the deltas from selected owned assets.

### Compatibility strategy

Generic asset listing continues to return assets lacking BIS fields. Legacy marketplace items lacking structured deltas remain generic or are shown as migration-required rather than receiving an inferred effect. New issuance and migrated issuance require the complete structured shape. This avoids silently upgrading an immutable asset with a guessed gameplay rule.

### Migration and operation safety

Admin migration targets only the nine verified Marketplace catalog asset IDs in the selected Game Wallet. It must read and display the exact target set, require the existing explicit burn confirmation, burn each target through the current guarded path, verify absence, mint the nine items with stable new operation IDs and the new metadata, then verify exactly one fresh holding per catalog ID before publication. Partial or uncertain results pause reconciliation; they must not trigger blind reminting.

The migration must record no secrets and must use the existing operation journals and retry protections. A failed or unknown burn/remint leaves truthful recovery state and does not claim a complete catalog.

### Local integration and verification

Build the updated integration package, consume it through the local game integration path, and run the shared Vite launcher for Admin, Marketplace, Onboarding, and Integration. The game verification must cover receiving/owning an item, selecting it, exposing the structured delta, and applying the movement-speed gameplay change. Browser checks may use Playwright, but live wallet success requires fresh chain reads and transaction evidence rather than UI appearance alone.

## Risks / Trade-offs

- [Immutable metadata] → Existing assets cannot be edited; require exact-target burn/remint and publish only after fresh verification.
- [Description drift] → Treat `bisDescription` as presentation-only and validate structured deltas independently.
- [Nested metadata compatibility] → Keep the public contract JSON-safe but explicitly support only the required array-of-object shape; reject malformed or excessively large structures.
- [Legacy items] → Do not infer missing effects; classify them as migration-required or generic until reminted.
- [Partial wallet mutation] → Reuse durable operation IDs, reservations, status reconciliation, and explicit recovery UI; never retry an uncertain operation with a new ID automatically.
- [Game/API mismatch] → Add contract tests proving the game consumes deltas and does not derive values from family or tier.
- [Wallet targeting error] → Require a fresh selected Game Wallet identity and an exact displayed target list before any burn operation.

## Migration Plan

1. Apply the metadata and API changes locally; run focused tests, typecheck, and production builds.
2. Start the local BIS Admin and Marketplace plus the local game integration and verify the non-mutating flows.
3. Select and display the intended Game Wallet and exact nine target assets; stop if the inventory differs.
4. Burn the nine existing Marketplace assets through the guarded Admin flow and verify their absence.
5. Remint the nine catalog assets with new structured metadata and verify one fresh holding per catalog item.
6. Refresh the local Marketplace, buy one item into the Player Wallet, equip it in the game, and verify the game applies the chain-provided delta.
7. If migration is interrupted, reconcile the recorded operations before any further burn or mint; do not use a second set of IDs to bypass uncertainty.

## Open Questions

- Confirm the exact local game repository/path and its expected BIS package-linking mechanism before implementation.
- Confirm the selected Game Wallet and the nine target asset IDs immediately before live migration; this is a runtime safety check and does not change the implementation design.
