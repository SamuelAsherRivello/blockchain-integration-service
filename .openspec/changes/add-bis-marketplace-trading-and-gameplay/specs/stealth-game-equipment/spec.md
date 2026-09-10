## Purpose

Make the Stealth & Steel game consume the public BIS equipment selection while preserving a playable account-free guest experience.

## ADDED Requirements

### Requirement: Equipment uses the approved tier effects
Stealth & Steel SHALL apply Shoes I/II/III as a 10%/20%/30% increase to player movement speed, Dagger I/II/III as a 10%/20%/30% increase to player-inflicted damage, and Shield I/II/III as a 10%/20%/30% reduction to damage received by the player. A family without an active, freshly owned selection SHALL have no effect.

#### Scenario: Player spawns with tier-two equipment
- **WHEN** the next player spawn snapshots effective Shoes II, Dagger II, and Shield II selections
- **THEN** that player has 20% higher movement speed and inflicts 20% more damage than baseline
- **AND** damage received by that player is reduced by 20% from baseline

#### Scenario: Guest plays without BIS account
- **WHEN** a guest starts or continues Stealth & Steel without a BIS account or selected equipment
- **THEN** the game remains playable with its baseline movement, damage, and defense behavior
- **AND** no account prompt blocks gameplay

### Requirement: Equipment effects snapshot on the next player spawn
The game SHALL snapshot the active, freshly owned BIS equipment selections when a player is spawned. Selection or ownership changes after that spawn SHALL NOT mutate the current player's equipment effects and SHALL take effect on the next player spawn.

#### Scenario: Selection changes during an active life
- **WHEN** the user changes Shoes selection after the current player has spawned
- **THEN** the current player's movement effect remains unchanged
- **AND** the new Shoes effect applies when the next player is spawned, provided the active wallet still owns it

### Requirement: Settings Items shows the active wallet's owned items
Settings SHALL contain an Items page that uses the public BIS API to show a grid of all recognized Stealth & Steel items freshly owned by the active player wallet. No item SHALL be selected by default. The user SHALL be able to choose at most one Shoes, one Dagger, and one Shield, or clear any family selection. Items not owned by the active wallet SHALL NOT be selectable.

#### Scenario: Player opens Settings Items
- **WHEN** an active player profile with owned marketplace items opens Settings, then Items
- **THEN** the page shows the wallet's recognized owned items in a grid and accurately marks its saved selections
- **AND** it does not show another profile's items as owned or selected

#### Scenario: Player replaces a family selection
- **WHEN** the player selects a different owned Dagger
- **THEN** the new Dagger becomes the only selected Dagger
- **AND** Shoes and Shield selections remain unchanged

### Requirement: HUD shows three ordered item slots
The game HUD SHALL show `Items: [][][]` under Gold, with the three icon slots ordered Shoes, Dagger, then Shield. Each slot SHALL show the effective selected item's icon or remain empty when that family has no effective selection.

#### Scenario: Player spawns with Shoes and Shield only
- **WHEN** the spawned player's effective loadout contains a Shoes item and a Shield item but no Dagger
- **THEN** the HUD shows the Shoes icon in the first slot, an empty second slot, and the Shield icon in the third slot
- **AND** the Items row appears under Gold

### Requirement: Game equipment icons use chain asset URLs
Every Stealth & Steel equipment icon rendered in the Items page, HUD, or any other game location SHALL load at runtime from the URL carried by that exact chain asset. The game SHALL NOT use a catalog-ID-to-bundled-icon mapping as the image source.

#### Scenario: Selected item appears in the HUD
- **WHEN** an effective selected item with a chain-provided icon URL is shown in its HUD slot
- **THEN** the game requests that chain-provided URL for the icon

### Requirement: Game uses the public BIS equipment contract
The game SHALL consume owned-item and equipment-selection state through the packaged BIS public API and SHALL NOT import Arkade-specific types, recovery data, wallet secrets, or Marketplace implementation details.

#### Scenario: Player has active loadout
- **WHEN** a player starts the game with current BIS selections containing freshly owned items
- **THEN** the game receives only the public item and effect data needed for its Settings UI, HUD, and gameplay
- **AND** it does not receive wallet secrets or private marketplace data
