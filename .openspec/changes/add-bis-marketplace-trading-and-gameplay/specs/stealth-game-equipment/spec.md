## Purpose

Make the Stealth & Steel game consume the public BIS equipment selection while preserving a playable account-free guest experience.

## ADDED Requirements

### Requirement: Selected equipment affects Stealth & Steel only
Stealth & Steel SHALL apply a Shoes selection only to player movement speed, a Dagger selection only to player damage, and a Shield selection only to player damage received. It SHALL use no effect for a family without an active, still-owned selection.

#### Scenario: Guest plays without BIS account
- **WHEN** a guest starts or continues Stealth & Steel without a BIS account or selected equipment
- **THEN** the game remains playable with its baseline movement, damage, and defense behavior
- **AND** no account prompt blocks gameplay

### Requirement: Game uses the public BIS equipment contract
The game SHALL consume equipment selection through the packaged BIS public API and SHALL not import Arkade-specific types, recovery data, or Marketplace implementation details.

#### Scenario: Player has active loadout
- **WHEN** a player starts the game with a current BIS loadout containing selected owned items
- **THEN** the game receives only the public equipment effect data needed for gameplay
- **AND** it does not receive wallet secrets or private marketplace data
