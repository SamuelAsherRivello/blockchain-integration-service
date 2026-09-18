## ADDED Requirements

### Requirement: Public asset APIs enforce network-specific ownership
The UI-independent mint and list APIs SHALL execute only against the active account's verified test network and SHALL associate each result and retry guard with that network. A caller SHALL receive unavailable or account-changed rather than a result from a fallback or previous network.

#### Scenario: Asset mint after a network change
- **WHEN** a prepared asset operation completes after the selected network changes
- **THEN** it cannot submit or report ownership in the new network session
