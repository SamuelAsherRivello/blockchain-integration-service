## ADDED Requirements

### Requirement: Production forms show the active test network
Every Account form and Admin account summary SHALL name the current selected test network. Network labels, guidance, and sanitized errors SHALL not claim Signet while a Mutinynet session is active; no active-network presentation SHALL silently substitute Signet for an absent or invalid selection.

#### Scenario: Mutinynet account form
- **WHEN** a user opens an Account form with Mutinynet selected
- **THEN** its network header and applicable guidance identify Mutinynet
- **AND** no static Signet label is displayed as the active network
