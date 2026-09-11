## MODIFIED Requirements

### Requirement: Signet-gated persistent restoration
The logged-in message SHALL display "You are now logged in as" followed by a line break and "Account ID: ", the first four and last four characters of the active public profile ID separated by an ellipsis, and a period. The shortened ID SHALL use code styling.
Restore SHALL reconstruct the same compatible identity using the creation derivation and SHALL require successful Signet connection before saving or activating. Only account access SHALL be restored; balances, achievements, the full account menu, and gameplay progress SHALL remain outside A3. Successful durable saving SHALL immediately activate the profile, emit accountConnected with its existing public profile ID once for the initiating operation, clear transient recovery input, and return to the Account dialogue showing "You are now logged in as Account ID: <first 4 characters>…<last 4 characters>.", Log Out, and Back. No further Continue step SHALL be required. A restored account SHALL survive reload and browser restart on the same origin/profile using the existing account persistence contract. Before saving or activation, BIS SHALL verify that the restored public profile ID is not the currently selected Game Wallet. A match SHALL reject the Player Wallet restoration with a clear non-secret role-conflict error, save or activate neither role, preserve the existing Game Wallet selection, and emit no accountConnected event.

#### Scenario: Restore the same account
- **WHEN** an experience-created account's phrase is restored with Signet available and saving succeeds
- **THEN** the original profile ID becomes active, the normal logged-in Account dialogue appears, and accountConnected carries only that public ID
- **AND** reloading the same origin reopens that account without phrase entry

#### Scenario: Restored player conflicts with Game Wallet
- **WHEN** a valid Player Wallet recovery phrase resolves to the public profile ID currently selected as the Game Wallet
- **THEN** BIS shows a clear role-conflict error and does not save, activate, or emit an event for that Player Wallet
- **AND** the configured Game Wallet remains selected and the recovery material remains private
