# Spec Delta

## ADDED Requirements

### Requirement: Released demos integrate the Signet Vercel game signer
The release SHALL publish Signet Server and Mutinynet Local through BIS Admin/Marketplace and the matching game. Existing routes and immutable assets SHALL remain usable. Completion SHALL require successful workflows and exact deployment/version evidence for both tuples. Hosted Mutinynet qualification SHALL NOT block the Local release.

#### Scenario: Published Admin and Marketplace
- **WHEN** the Signet release is declared complete
- **THEN** both published applications identify the compatible Vercel Signet game signer and exercise applicable existing game-wallet behavior without Game Wallet Login
- **AND** the deployed BIS versions and release documentation match the intended release

### Requirement: Matching Signet Stealth and Steel integration release
The release SHALL update Stealth & Steel with the exact verified BIS package and matching release version, backend configuration and local development integration. Its independent Pages workflow SHALL publish the game. Completion SHALL require live Signet game acceptance with Vercel signing and verified Local Mutinynet behavior.

#### Scenario: Published game consumer
- **WHEN** the game is updated for the Signet release
- **THEN** its vendored package hash, dependency lock and public version identities match the verified BIS release
- **AND** its deployed gameplay and applicable game-wallet behavior work without importing the server mnemonic

#### Scenario: Signet Server backend unreachable
- **WHEN** a controlled local or published-client check makes the signer endpoint unreachable
- **THEN** the client retains Server mode and reports the actual connection health
- **AND** pending server operations are not reassigned to the manual wallet
- **AND** no Local mode switch is offered on Signet

#### Scenario: Mutinynet selected before qualification
- **WHEN** the published game selects Mutinynet while hosted Mutinynet remains unqualified
- **THEN** it uses Local, shows the upper-left mode label and supports all applicable existing features without a BIS server
- **AND** the game does not select Signet keys or pretend that Mutinynet signing succeeded

### Requirement: Local candidate integration precedes public release
A frozen, verified integration archive SHALL be eligible for local game import before Pages publication. Final release SHALL use the same accepted immutable hash and matching complete versions after both required workflows pass. Changed archive bytes SHALL invalidate affected candidate evidence.

#### Scenario: The game needs the candidate API before publication
- **WHEN** BIS package checks, source provenance and archive inventory/hash pass
- **THEN** the game may import that exact local candidate and run its acceptance checks
- **AND** this local import does not claim live acceptance or public publication
