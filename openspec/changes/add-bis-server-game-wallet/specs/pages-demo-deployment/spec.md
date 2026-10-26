# Spec Delta

## ADDED Requirements

### Requirement: Released demos integrate the Vercel game signer
The bis-server milestone 1 release SHALL publish the Vercel signer and BIS Admin/Marketplace Pages clients configured to use it. Existing published application routes and immutable assets SHALL remain usable. Completion SHALL require exact deployment success and real game-wallet signing acceptance, not only an identity probe.

#### Scenario: Published Admin and Marketplace
- **WHEN** milestone 1 is declared complete
- **THEN** both published applications identify the compatible Vercel game signer and exercise applicable existing game-wallet behavior without Game Wallet Login
- **AND** the deployed BIS versions and release documentation match the intended release

### Requirement: Matching Stealth and Steel integration release
Milestone 1 SHALL update Stealth & Steel with the exact verified BIS package and matching release version, backend configuration and local development integration. Its independent Pages workflow SHALL publish the game. Completion SHALL require live game acceptance with Vercel signing and a verified manual fallback path.

#### Scenario: Published game consumer
- **WHEN** the game is updated for milestone 1
- **THEN** its vendored package hash, dependency lock and public version identities match the verified BIS release
- **AND** its deployed gameplay and applicable game-wallet behavior work without importing the server mnemonic

#### Scenario: Backend unreachable
- **WHEN** a controlled local or published-client check makes the signer endpoint unreachable
- **THEN** existing manual Game Wallet Login remains usable for new work
- **AND** pending server operations are not reassigned to the manual wallet
