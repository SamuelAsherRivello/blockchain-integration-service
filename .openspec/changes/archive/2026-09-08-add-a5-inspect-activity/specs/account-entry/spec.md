## MODIFIED Requirements

### Requirement: Honest profile routing boundary
Only Accounts Details SHALL display the Account ID field and its Copy action. Copy SHALL copy the complete active public profile ID. Account and all other BIS windows SHALL NOT repeat the Account ID in their subtitles. The shortened ID SHALL use its first four and last four characters separated by an ellipsis. Existing logged-in and Network: Signet messaging SHALL remain available without repeating the ID.
A1 SHALL remain the entry-button demonstration. A2 SHALL own creation and A3 SHALL own restoration; both SHALL return to the actual active Account menu without manufacturing profiles. An active account SHALL hide Create Account and Restore Account and expose Accounts Details, the existing Send/Receive/Swap routes, Log Out and Back. Accounts Details SHALL open a submenu with Balance, Transactions immediately below Balance, Assets immediately below Transactions, and Back to Account. Opening Account or its submenu alone SHALL NOT request balances, history or assets. Balance SHALL use A4's live available/total balances and Refresh; A5 SHALL own Transactions and its detail/copy flow; account-assets SHALL own Assets and Asset Detail. Back from Balance, Transactions or Assets SHALL return to Accounts Details, while Back from Transaction Detail or Asset Detail SHALL return to its list. Existing recovery access, receiving, sending, transfer and logout behavior SHALL retain their separate capability boundaries. Log Out SHALL use A6's production confirmation and SHALL NOT immediately clear the account. Back from Account SHALL restore the preceding host presentation. The demo SHALL NOT report unverified stories as complete.

#### Scenario: Saved account opens safely
- **WHEN** a player opens Account with a saved active profile
- **THEN** the logged-in Account menu appears without an unimplemented-menu error or duplicate creation
- **AND** Log Out is enabled and opens the A6 confirmation

#### Scenario: Route validation does not imply wallet functionality
- **WHEN** profile routing is tested and documented
- **THEN** logged-out creation entry, the active Account menu, the Accounts Details submenu, A4 Balance, and A6 logout are distinguished
- **AND** A3 restores account access only before entering Account; balance loading belongs to A4; A5 owns all SDK-provided incoming and outgoing transaction history, Assets owns runtime asset inspection, and other unimplemented menu features remain deferred
#### Scenario: Open owned assets from Account
- **WHEN** a player with an active profile selects Assets immediately below Transactions in Accounts Details
- **THEN** the production Assets list opens and reads that account's current holdings
- **AND** Back from Asset Detail returns to Assets, while Back from Assets returns to Accounts Details
