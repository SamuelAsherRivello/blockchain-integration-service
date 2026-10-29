# Spec Delta

## ADDED Requirements

### Requirement: Source-aware Game Wallet developer settings
Game Wallet Developer Settings SHALL identify server/manual source and connection status. Connected server mode SHALL show public identity and Retry without browser import/logout controls. If no running server is findable, settings SHALL offer the existing manual create/restore/login and preserve its address/copy/loading/logout behavior.

#### Scenario: Compatible signer
- **WHEN** BIS connects to the compatible local or Vercel signer
- **THEN** settings identifies its public game wallet without requesting a recovery phrase

#### Scenario: No findable signer
- **WHEN** the bounded local or configured hosted connection attempt fails
- **THEN** settings exposes working manual Game Wallet Login and Retry
- **AND** the player can explicitly log in a local game wallet for new work

### Requirement: Workflow mode in the upper-left BIS header
After network selection, the shared top header SHALL show exactly `Server` or `Direct` in its upper-left corner and retain network and BIS version. The label SHALL describe the selected workflow. Connection health, funds availability and transaction outcome SHALL be reported separately.

#### Scenario: Mutinynet is selected
- **WHEN** the user selects Mutinynet
- **THEN** the header shows `Direct` at the upper-left with Mutinynet and the current BIS version
- **AND** no BIS server connection is required

#### Scenario: Signet server connection changes
- **WHEN** Signet Server mode is connecting, connected or reports a connection failure
- **THEN** its upper-left mode label remains `Server` and its distinct health status states the actual condition
- **AND** the mode label alone does not claim readiness or transaction success

#### Scenario: Explicit Direct fallback
- **WHEN** the user explicitly selects Direct for independent new Signet work
- **THEN** the upper-left label changes to `Direct` while network/version remain visible
- **AND** pending Server operations keep their original authority and evidence
