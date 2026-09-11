## ADDED Requirements

### Requirement: Foreground checkout operation presentation
The Marketplace SHALL present each active Buy, Sell, or explicit checkout reconciliation operation with the shared BIS Pending Operation Dialog from the moment its foreground async work begins through confirmation, required wallet and inventory refresh, and final rendered ready state. The dialog SHALL be centered above a dark translucent backdrop, show a current label ending in `ing...` above the shared spinning bolt, and prevent interaction with covered Marketplace controls. Marketplace SHALL not duplicate the dialog's markup, styling, animation, focus management, or reduced-motion behavior. A confirmed checkout SHALL reveal the refreshed item state only after the dialog closes.

#### Scenario: Player starts an eligible purchase
- **WHEN** the operator activates Buy for an eligible Marketplace item
- **THEN** the centered shared BIS Pending Operation Dialog immediately covers the Marketplace with a dark translucent backdrop while foreground checkout work runs
- **AND** the dialog stays visible until required payment/delivery confirmation, refreshed ownership/listing data, and the resulting Marketplace state are ready

#### Scenario: Active checkout ends with an error or an unconfirmed outcome
- **WHEN** foreground Buy or Sell work fails or reaches an unconfirmed durable checkout result
- **THEN** Marketplace uses the shared dialog's terminal error presentation for a failure or closes the loading presentation for an unconfirmed result
- **AND** it preserves the exact-item durable checkout and its safe recovery/reconciliation state without claiming a completed trade

#### Scenario: Operator reconciles an unresolved checkout
- **WHEN** the operator starts explicit reconciliation for an unresolved Marketplace checkout
- **THEN** the same centered shared BIS Pending Operation Dialog covers the foreground reconciliation work
- **AND** Marketplace returns to the refreshed terminal or item-scoped recovery state without leaving a separate inline loading control

### Requirement: Item-scoped recovery follows foreground presentation
After an active Buy or Sell operation has transitioned to a durable unresolved checkout, Marketplace SHALL return to its item-scoped pending/recovery presentation rather than retain a settlement-length blocking dialog. It SHALL continue to reserve the exact conflicting item and inputs while catalog browsing, wallet status, loadout inspection, and disjoint safe actions remain available.

#### Scenario: Purchase delivery remains unresolved
- **WHEN** a purchase payment is confirmed but exact-item delivery remains unresolved after foreground operation work ends
- **THEN** Marketplace removes the centered loading prompt and shows the item's pending/recovery state
- **AND** it prevents a duplicate conflicting action without blocking unrelated safe Marketplace interactions
