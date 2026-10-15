# Spec Delta

## ADDED Requirements

### Requirement: Asset detail exposes actionable identity and provenance
Asset Detail SHALL show the full Asset ID, exact owned quantity and base-unit quantity, Name, Ticker, Decimals, the active account network, the network-correct Explorer URL when available, and Icon URL when available. It SHALL also show a source or mint transaction ID and mint operation ID when those identifiers are known for the selected holding. Unknown or unavailable values SHALL be labeled `Not available` and SHALL never be inferred from a name, ticker, balance change, or asset ID.

The detail report and its copy action SHALL include these labeled values in stable order. Full identifiers SHALL remain selectable and usable for manual copying without wrapping away the significant characters.

#### Scenario: Level 3 achievement has inspectable identity
- **WHEN** the player opens an owned asset with name `Achievement: Level 3`, ticker `LVL3`, decimals `0`, and quantity `1`
- **THEN** Asset Detail shows those values plus the complete Asset ID, active network, Explorer URL, and any known source transaction or mint operation identifiers
- **AND** the copied report contains the same values and the exact base-unit quantity `1`

#### Scenario: External holding has no local provenance
- **WHEN** an owned asset was created outside BIS and no source transaction or mint operation record is available
- **THEN** Asset Detail remains usable and labels those provenance fields `Not available`
- **AND** it does not claim that the holding completed a BIS mint operation

### Requirement: Asset detail actions use the selected account and network
For a valid selected owned holding, Open On Explorer SHALL open the explorer URL for the active account's verified network in a new tab with safe opener protections. Burn SHALL remain enabled until the player explicitly confirms or the holding/account state becomes invalid, and SHALL submit the selected asset ID and entire displayed base-unit quantity through the existing burn safety contract. A missing or unsupported explorer URL SHALL disable only Open On Explorer and expose an accessible reason; it SHALL not disable Burn.

#### Scenario: Mutinynet asset opens the Mutinynet explorer
- **WHEN** the active account is verified on Mutinynet and the selected asset has a valid Asset ID
- **THEN** Open On Explorer is enabled and opens the Mutinynet asset page
- **AND** the action does not use the Signet URL

#### Scenario: Explorer URL unavailable but burn is valid
- **WHEN** the selected asset is owned and burnable but its explorer URL cannot be constructed
- **THEN** Open On Explorer is disabled with an accessible explanation
- **AND** Burn remains available and uses the selected asset's exact base-unit quantity after confirmation

#### Scenario: Selection changes before an action completes
- **WHEN** the player changes account, leaves Asset Detail, or the selected holding disappears before a delayed action completes
- **THEN** the obsolete action cannot open an explorer page for another asset or submit a burn under another account
