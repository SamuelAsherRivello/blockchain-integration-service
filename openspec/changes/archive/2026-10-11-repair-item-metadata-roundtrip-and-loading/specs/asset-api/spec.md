## ADDED Requirements

### Requirement: Structured metadata transport preserves gameplay values
BIS SHALL encode supported structured gameplay metadata into chain-compatible values before issuance and decode and validate it on listing. The public API SHALL retain structured arrays, including empty trophy arrays, without deriving effects from presentation fields. Malformed structured values SHALL prevent equipment classification while retaining generic holdings.

#### Scenario: Nine item definitions survive issuance transport
- **WHEN** each approved catalog item is encoded, issued, and freshly listed
- **THEN** its validated attribute deltas and description equal the requested values
- **AND** classification uses those chain values

#### Scenario: Malformed structured metadata
- **WHEN** chain metadata contains invalid JSON or invalid attribute entries
- **THEN** the generic holding remains visible without fabricated gameplay values

#### Scenario: Selected network remains authoritative
- **WHEN** Admin mints or lists, Marketplace purchases or lists, or the game reads owned equipment
- **THEN** reads and submissions use the Player Wallet's selected network and a matching Game Wallet
- **AND** explicit network mismatch blocks submission
