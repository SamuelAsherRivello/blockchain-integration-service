# Spec Delta

## ADDED Requirements

### Requirement: Marketplace Admin operations use the selected asset format
C.G.2, C.G.3, and C.G.4 SHALL expose and honor the active Admin asset-format selection, defaulting to the latest registered format. Mint, list, verify, burn, and recovery actions SHALL use the selected format's catalog and compatibility rules while retaining the existing active Game Wallet, identity, network, and operation-intent checks.

#### Scenario: Admin operates an older catalog format
- **WHEN** an operator explicitly selects a supported older format in Admin
- **THEN** C.G.3 and C.G.4 act only on compatible selected-format catalog holdings in the active Game Wallet
- **AND** C.G.2 does not mint a different format under that selection

#### Scenario: Admin uses the default selection
- **WHEN** an operator opens Admin with no saved format choice for the current scope
- **THEN** the current registry version is selected
- **AND** all new catalog minting uses that version

### Requirement: Admin exposes and controls automatic format migration
Admin SHALL show version-migration progress and safe recovery state for selected-format catalog holdings. When the latest successor enables automatic upgrade, Admin SHALL automatically start or resume only eligible migrations in the active wallet scope; it SHALL retain a format-level control to opt out before a new successor's migration begins. Disabling automatic upgrade SHALL not abandon or duplicate a migration that has already crossed a durable submission boundary.

#### Scenario: Default automatic migration finds old catalog items
- **WHEN** the active Game Wallet contains supported predecessor catalog holdings and the latest successor enables automatic upgrade
- **THEN** Admin starts/resumes durable per-item migration and reports each replacement and retirement phase
- **AND** it preserves unrelated, unsupported, or already-recovering holdings
