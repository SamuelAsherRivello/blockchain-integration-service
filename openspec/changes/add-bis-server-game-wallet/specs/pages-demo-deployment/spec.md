# Spec Delta

## ADDED Requirements

### Requirement: Released demos integrate the Signet Vercel game signer
The bis-server Signet release SHALL publish the Vercel signer and BIS Admin/Marketplace Pages clients configured to use it. Existing published application routes and immutable assets SHALL remain usable. Completion SHALL require exact deployment success and real Signet game-wallet signing acceptance, not only an identity probe. Mutinynet hosted signing SHALL remain unavailable until the two-network qualification proposal is complete.

#### Scenario: Published Admin and Marketplace
- **WHEN** the Signet release is declared complete
- **THEN** both published applications identify the compatible Vercel Signet game signer and exercise applicable existing game-wallet behavior without Game Wallet Login
- **AND** the deployed BIS versions and release documentation match the intended release

### Requirement: Matching Signet Stealth and Steel integration release
The Signet release SHALL update Stealth & Steel with the exact verified BIS package and matching release version, backend configuration and local development integration. Its independent Pages workflow SHALL publish the game. Completion SHALL require live Signet game acceptance with Vercel signing and a verified manual fallback path.

#### Scenario: Published game consumer
- **WHEN** the game is updated for the Signet release
- **THEN** its vendored package hash, dependency lock and public version identities match the verified BIS release
- **AND** its deployed gameplay and applicable game-wallet behavior work without importing the server mnemonic

#### Scenario: Backend unreachable
- **WHEN** a controlled local or published-client check makes the signer endpoint unreachable
- **THEN** existing manual Game Wallet Login remains usable for new work
- **AND** pending server operations are not reassigned to the manual wallet

#### Scenario: Mutinynet selected before qualification
- **WHEN** the published game selects Mutinynet before proposal 2 is complete
- **THEN** hosted signing is reported unavailable and the manual flow remains explicit
- **AND** the game does not select Signet keys or pretend that Mutinynet signing succeeded
