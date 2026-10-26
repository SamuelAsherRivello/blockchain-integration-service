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

### Requirement: Server connection indicator in the BIS banner
The shared BIS banner SHALL retain network and version and add the exact word `Server` only while a compatible server signer is connected. Failed connection checks SHALL remove the indicator. The indicator SHALL report signer connectivity, not funds availability or transaction confirmation.

#### Scenario: Connection changes
- **WHEN** a valid signer connects and later becomes unreachable
- **THEN** `Server` appears while connected and disappears after the failed check
- **AND** manual mode shows no `Server` indicator and retains network/version
