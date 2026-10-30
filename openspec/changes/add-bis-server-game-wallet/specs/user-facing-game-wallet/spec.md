# Spec Delta

## ADDED Requirements

### Requirement: Network-aware Game Wallet developer settings
Game Wallet Developer Settings SHALL identify the network-selected Local or Server source and connection status. Signet Server settings SHALL show public identity and Retry without browser Game Wallet import/login controls. Mutinynet Local settings SHALL preserve its existing local Game Wallet create/restore/login, address/copy/loading/logout behavior.

#### Scenario: Compatible signer
- **WHEN** BIS connects to the compatible local or Vercel signer
- **THEN** settings identifies its public game wallet without requesting a recovery phrase

#### Scenario: Signet server unavailable
- **WHEN** the bounded Signet server connection attempt fails
- **THEN** settings keeps Server selected, reports unavailable health, and exposes Retry
- **AND** it does not offer a Local Game Wallet switch

### Requirement: Workflow mode in the upper-left BIS header
After network selection, the shared top header SHALL show exactly `Local` or `Server` in its upper-left corner and retain network and BIS version. The label SHALL describe the selected workflow. Connection health, funds availability and transaction outcome SHALL be reported separately.

#### Scenario: Mutinynet is selected
- **WHEN** the user selects Mutinynet
- **THEN** the header shows `Local` at the upper-left with Mutinynet and the current BIS version
- **AND** no BIS server connection is required

#### Scenario: Signet server connection changes
- **WHEN** Signet Server mode is connecting, connected or reports a connection failure
- **THEN** its upper-left mode label remains `Server` and its distinct health status states the actual condition
- **AND** the mode label alone does not claim readiness or transaction success

#### Scenario: Signet server unavailable
- **WHEN** the Signet server is connecting, connected or unavailable
- **THEN** the upper-left label remains `Server` while network/version remain visible
- **AND** pending Server operations keep their original authority and evidence
