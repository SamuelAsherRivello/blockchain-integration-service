## ADDED Requirements

### Requirement: C6 completion reward demonstration
Admin SHALL expose C6 Reward Player With Trophy After Level Complete under C. Assets. Its Runtime Preview SHALL simulate a two-level completion sequence, exercise intermediate/final prompts and use the same generic public asset collection behavior as the game. Opening, Continue and Restart SHALL NOT mint. Only an explicit enabled Collect action SHALL call real wallet issuance; synthetic wallet outcomes SHALL be confined to isolated test fixtures.

#### Scenario: Preview progression
- **WHEN** the user opens C6 then chooses Continue To Next Level
- **THEN** Runtime Preview moves from Level Completed to Game Completed without a wallet mutation
- **AND** Restart Game closes the simulation

#### Scenario: Production wallet action
- **WHEN** an eligible user explicitly clicks Collect in C6
- **THEN** the active wallet's public APIs perform collection and the prompt stays open through the truthful result
