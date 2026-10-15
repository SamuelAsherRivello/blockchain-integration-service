## ADDED Requirements

### Requirement: H Marketplace Admin stories
Admin SHALL expose an H. Marketplace section with H1 for minting or reconciling the nine-item catalog through the active Game Wallet and H2 labelled `Burn All Items for Marketplace`. H2 SHALL burn only freshly owned assets classified on-chain as Stealth & Steel items, preserve trophies and unrelated assets, report per-item progress truthfully, and keep unrelated Admin and Runtime Preview interaction available while an item is pending or unknown.

#### Scenario: Run H1
- **WHEN** the operator explicitly runs H1 with an eligible active Game Wallet
- **THEN** Admin mints or reconciles all nine intended catalog items and reports each actual result
- **AND** Runtime Preview does not fabricate game ownership or trade outcomes

#### Scenario: Run H2
- **WHEN** the operator explicitly runs H2 with an active Game Wallet that owns marketplace items
- **THEN** Admin processes every eligible item it can safely submit or reconcile and preserves trophies and unrelated assets
- **AND** one pending item does not globally disable unrelated user interaction

### Requirement: X multiple-player-profile story
The Admin demonstration and synchronized user-story documentation SHALL add an X story for retaining and switching multiple BIS player profiles. The demonstrated production Account entry SHALL list shortened public IDs, mark the active profile, switch saved profiles without restoration, and offer Create or Restore through Add Profile. Admin SHALL observe only non-secret public state and SHALL NOT expose recovery material.

#### Scenario: Demonstrate profile switching
- **WHEN** multiple player profiles are saved and the operator opens the X story
- **THEN** Runtime Preview uses the production Account profile chooser and can switch the active public ID
- **AND** each profile retains its own wallet and equipment selections

#### Scenario: Demonstrate adding a profile
- **WHEN** Add Profile is selected during the X story
- **THEN** the production Create and Restore paths are offered without replacing existing profiles
