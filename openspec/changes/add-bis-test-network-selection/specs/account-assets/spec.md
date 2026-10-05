## MODIFIED Requirements

### Requirement: Two-page asset inspection
An active Account SHALL offer Assets immediately below Transactions. Assets SHALL show the title Assets, current account identity, the selected verified test-network name, Refresh, a bounded scrollable list, and Back. Selecting a row SHALL replace the list with Asset Detail in the same dialog. Back from detail SHALL return to the same list without another ownership request, retaining the selected asset, scroll position, and focus on its row when that row remains present. Back from the list SHALL return to Account. Opening Account alone SHALL NOT request assets. Asset reads and presentation SHALL use only the selected network's verified provider/indexer routes.

#### Scenario: Mutinynet asset view
- **WHEN** an active Mutinynet account opens Assets after its operator verification succeeds
- **THEN** the page identifies Mutinynet and lists only fresh Mutinynet ownership results
- **AND** Signet holdings are neither requested nor shown

#### Scenario: Inspect and return
- **WHEN** a user opens a selected-network asset row and then Back from Asset Detail
- **THEN** the Assets list returns without another ownership request, preserving selection and scroll position when the row remains present

#### Scenario: Keyboard and narrow host
- **WHEN** Assets is used by keyboard in the supported narrow portrait host
- **THEN** every enabled action has visible focus, labels remain readable, and Back is reachable without horizontal overflow
