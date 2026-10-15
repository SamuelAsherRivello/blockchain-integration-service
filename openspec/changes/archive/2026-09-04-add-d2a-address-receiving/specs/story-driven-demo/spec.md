## ADDED Requirements

### Requirement: D2a address receiving demonstration and evidence
The Admin catalog SHALL include D2a, labeled Receive Funds, using the production public API and UI. With an active account it SHALL open Receive. Without an active account it SHALL open the ordinary account chooser; account creation/restoration and subsequent Receive navigation SHALL remain explicit player actions. The demonstration SHALL NOT auto-create an account, fund it, or fabricate transaction outcomes. Existing demonstrations SHALL remain intact.

#### Scenario: Active account demonstration
- **WHEN** D2a is selected with an active account
- **THEN** the production Receive page opens with address fields and unavailable Lightning controls

#### Scenario: Logged-out demonstration
- **WHEN** D2a is selected without an account
- **THEN** the normal account chooser opens without automatic creation, restoration, or funding

### Requirement: Independent D2a delivery boundary
D2a documentation SHALL distinguish implemented address receiving from blocked D2b live invoices, preserving D2a/D2b and unrelated story IDs. Completion evidence SHALL cover address loading, copying and errors, Refresh failure/retry, navigation, keyboard access, and readable 9:16 layout in the demo and an independent host. It SHALL include automated tests, typecheck, and build results. Test doubles SHALL remain isolated from production outcomes. D2a completion SHALL NOT imply delivery of Lightning invoices, recovery, Activity extensions, account-clearing guards, D3 sending, or D4 transfers.

#### Scenario: D2a accepted while D2b blocked
- **WHEN** D2a meets its acceptance criteria and evidence is recorded
- **THEN** it can be reported complete independently of D2b
- **AND** D2b and unrelated pending verification remain explicitly incomplete
