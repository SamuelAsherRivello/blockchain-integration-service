# Spec Delta

## MODIFIED Requirements

### Requirement: Signet-gated persistent restoration
The logged-in message SHALL display "You are now logged in as" followed by a line break and "Account ID: ", the first four and last four characters of the active public profile ID separated by an ellipsis, and a period. The shortened ID SHALL use code styling.

Restore SHALL reconstruct the identity using the selected supported test network's configured Arkade integration and SHALL require successful connection to an operator that reports that same network before any profile lookup, saving, or activation. Only account access SHALL be restored; balances, achievements, the full account menu, and gameplay progress SHALL remain outside A.P.3. The derived public profile ID SHALL be used only to look up a local profile scoped to that same network; it SHALL NOT be used to infer whether the phrase has been used on another device, another origin, or another network.

When the derived identity is already saved locally for the selected network, successful restoration SHALL immediately activate the existing profile, emit `accountConnected` with its existing public profile ID once for the initiating operation, clear transient recovery input, and return to the Account dialogue showing "You are now logged in as Account ID: <first 4 characters>…<last 4 characters>.", Log Out, and Back. It SHALL not create a duplicate profile or show a creation confirmation.

When no same-network local profile exists, the application SHALL show a confirmation headed "Create New Account?" before saving or activating. Its body SHALL state: "This recovery phrase does not have an account on {Network} yet. Would you like to create one now?" `{Network}` SHALL be the selected network's user-facing label. Cancel SHALL clear the transient phrase and return to the logged-out Account dialogue without saving, activating, or emitting `accountConnected`. Create Account SHALL durably save and activate the derived identity as a separate profile scoped to the selected network, emit `accountConnected` once for the initiating operation, and return to the Account dialogue. This confirmation SHALL not claim that a network-side account was registered or that funds, assets, activity, or pending operations were copied from another network.

Before saving or activation, BIS SHALL verify that the restored public profile ID is not the currently selected Game Wallet. A match SHALL reject the Player Wallet restoration or creation with a clear non-secret role-conflict error, save or activate neither role, preserve the existing Game Wallet selection, and emit no `accountConnected` event.

#### Scenario: Restore the same account
- **WHEN** an experience-created account's phrase is restored with the selected network available and a matching local profile exists
- **THEN** the existing profile becomes active, the normal logged-in Account dialogue appears, and `accountConnected` carries only that public ID
- **AND** reloading the same origin reopens that account without phrase entry

#### Scenario: Confirm first local profile on a network
- **WHEN** a valid recovery phrase is verified against the selected network operator and its derived identity has no locally saved profile for that network
- **THEN** the application displays "Create New Account?" with the selected network label and does not save, activate, or emit `accountConnected` yet
- **AND** selecting Create Account saves and activates a new separate profile only for that network without copying balances, assets, activity, or operations from another network

#### Scenario: Cancel first local profile creation
- **WHEN** the first-local-profile confirmation is displayed and the player selects Cancel
- **THEN** the application clears the transient phrase, returns to the logged-out Account dialogue, and leaves every saved profile unchanged
- **AND** it emits no `accountConnected` event

#### Scenario: Restored player conflicts with Game Wallet
- **WHEN** a valid Player Wallet recovery phrase resolves to the public profile ID currently selected as the Game Wallet
- **THEN** BIS shows a clear role-conflict error and does not save, activate, or emit an event for that Player Wallet
- **AND** the configured Game Wallet remains selected and the recovery material remains private
