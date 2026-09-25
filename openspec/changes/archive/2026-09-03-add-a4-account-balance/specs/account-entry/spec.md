## MODIFIED Requirements

### Requirement: Honest profile routing boundary
Both Account and Account Details SHALL show beneath their title: "You are now logged in.", a line break, "Account ID: " and the shortened active public profile ID in code styling, another line break, and "Network: Signet". The shortened ID SHALL use its first four and last four characters separated by an ellipsis.
A1 SHALL remain the entry-button demonstration. A2 SHALL own creation and its minimal active-account endpoint. A3 SHALL own restoration and share that endpoint. All account entry paths SHALL recognize a real persisted active account and show the title Account with enabled lightning-prefixed Account Details, enabled lightning-prefixed Log Out, and enabled Back; they SHALL hide Create Account and Restore Account. Log Out SHALL open A6's backup confirmation without immediately clearing the account. Back SHALL restore the preceding host presentation. A4 SHALL provide an Account Details dialog reached through Account Details, with the title Account Details, the identity message, Network: Signet, live available/total balances and only lightning-prefixed Refresh and plain Back actions. Back from Details SHALL return to Account and clear balances; Account SHALL NOT initiate a balance read. Log Out SHALL NOT appear in Details; activity, assets/achievements, and receiving details SHALL remain deferred without placeholder actions; A6 SHALL own working logout. The demo SHALL NOT manufacture profiles or report unimplemented stories as complete.

#### Scenario: Saved account opens safely
- **WHEN** a player opens Account with a saved active profile
- **THEN** the logged-in Account menu appears without an unimplemented-menu error or duplicate creation
- **AND** Log Out is enabled and opens the A6 confirmation

#### Scenario: Route validation does not imply wallet functionality
- **WHEN** profile routing is tested and documented
- **THEN** logged-out creation entry, the shared A4 active dialog, and A6 logout are distinguished
- **AND** A3 restores account access only before entering the shared A4 dialog; balance loading belongs to A4 and the other menu features remain deferred
