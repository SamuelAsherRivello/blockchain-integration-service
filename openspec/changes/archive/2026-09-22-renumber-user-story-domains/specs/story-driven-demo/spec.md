# Spec Delta

## ADDED Requirements

### Requirement: Player and Game Wallet story lanes

The user-story Markdown SHALL identify the wallet responsibility of every wallet-related story with a visible lane: `P` for Player Wallet, `G` for Game Wallet, and `P/G` for behavior shared by both wallets. Stories that are administrative, experimental, or otherwise wallet-neutral SHALL be marked separately rather than being assigned an incorrect wallet lane.

#### Scenario: Reader identifies wallet ownership
- **WHEN** a reader opens any domain containing wallet-related stories
- **THEN** the domain presents separate Player Wallet and Game Wallet lanes, and each story appears in the lane matching the wallet it operates on or represents

#### Scenario: Shared behavior
- **WHEN** a story affects both wallet roles or provides common presentation behavior
- **THEN** it appears under `P/G` and is not duplicated as two independent stories

### Requirement: Renumbered domain catalog and Admin alignment

The user-story Markdown and Admin story navigator SHALL use the same from-scratch domain catalog: A Accounts, B Payments/Transfers, C Assets, D Contracts, E Transactions, F Integrations, and X Appendix. Admin SHALL expose the domains and wallet lanes in this order, showing only implemented demonstrations while retaining truthful status for documented partial, blocked, deferred, or live-pending stories.

#### Scenario: Admin and documentation agree
- **WHEN** a reader compares the Admin navigator with the user-story documentation
- **THEN** domain names, story IDs, lane labels, and story ordering match exactly

#### Scenario: Unimplemented work remains non-actionable
- **WHEN** a renumbered story is planned, blocked, deferred, or live-pending
- **THEN** renumbering updates its catalog identity and status but does not expose an implementation control or claim completion

## MODIFIED Requirements

### Requirement: UI and appendix story organization

The user-story Markdown SHALL use the from-scratch domain catalog and SHALL place each story under its new domain and wallet lane. The top-level domains SHALL be A. Accounts, B. Payments/Transfers, C. Assets, D. Contracts, E. Transactions, F. Integrations, and X. Appendix. Internal links, table references, diagram step labels, Admin labels, and documentation links SHALL use the new document numbering. A complete old-ID-to-new-ID cross-reference SHALL be included. Historical OpenSpec change paths, archived evidence, and existing runtime account-selection identifiers SHALL remain intact.

#### Scenario: New catalog navigation
- **WHEN** a reader follows a new domain or story link
- **THEN** it resolves to exactly one corresponding heading and displays the correct Player Wallet, Game Wallet, shared, or neutral lane

#### Scenario: Historical evidence lookup
- **WHEN** a reader starts from a former story ID in archived evidence or an OpenSpec change
- **THEN** the cross-reference identifies its new story ID without requiring historical files or change directories to be renamed

#### Scenario: Appendix navigation
- **WHEN** a reader follows a new domain table-of-contents link or a reference to a former story ID
- **THEN** it resolves to exactly one corresponding domain or story heading and the old-to-new cross-reference identifies the replacement ID
