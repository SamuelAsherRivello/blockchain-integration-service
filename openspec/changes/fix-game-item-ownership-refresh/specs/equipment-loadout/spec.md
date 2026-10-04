## MODIFIED Requirements

### Requirement: Effective selections require current ownership
BIS SHALL make a selected item effective only while a fresh ownership read confirms that the active player wallet owns the exact chain asset. A completed Marketplace delivery to that wallet SHALL be discoverable by a separately hosted game after the user explicitly establishes the matching player profile on that origin. A failed ownership check SHALL NOT make an unverified item effective, and BIS SHALL NOT activate an item merely because it appears in a static catalog, another profile, or browser storage from another origin.

#### Scenario: Equipped asset is no longer owned
- **WHEN** a fresh ownership read no longer contains the currently active Dagger
- **THEN** BIS clears that Dagger selection and reports it as unavailable
- **AND** it leaves unrelated selections unchanged

#### Scenario: Ownership cannot be verified
- **WHEN** BIS cannot freshly verify ownership of a saved selection
- **THEN** the item is absent from the effective loadout until ownership can be verified
- **AND** guest or baseline gameplay remains available

#### Scenario: Purchased item is read by the separately hosted game
- **WHEN** Marketplace has confirmed delivery of an exact Stealth & Steel item to the Player Wallet and the player explicitly opens the matching profile in the game origin
- **THEN** a fresh public equipment read returns that recognized item for the game's Items view
- **AND** the result is based on current chain ownership rather than copied browser wallet storage or a static catalog
