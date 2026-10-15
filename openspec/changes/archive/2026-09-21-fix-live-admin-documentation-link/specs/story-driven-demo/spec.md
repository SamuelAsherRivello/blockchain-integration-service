# Spec Delta

## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and nonempty categories. It SHALL begin without a selected story, including after refresh. Existing implemented Account demonstrations SHALL remain available, through Account Button and Account Dialog, with creation, restoration, balances, activity, logout, receiving, sending, and transfer accessible through the existing production flow. Dedicated shortcuts for these nested functions SHALL NOT appear in A. Account. Assets / C1 Mint Asset and Asset listing SHALL remain available alongside them. Pay-to-play SHALL expose Request Continue only once its real operation is implemented; other unimplemented stories and game-specific Achievements SHALL be omitted. The Admin heading SHALL be followed by User Stories and a Documentation link to the current user-story Markdown source. The link SHALL resolve from Vite's active base URL, including the development root and the deployed `/blockchain-integration-service/admin/` base, without appending duplicate documentation segments. The documentation page SHALL render the latest local working-tree Markdown in development and the corresponding explicit documentation entry in production builds. Legacy public documentation URLs MAY redirect to the documentation route, but internal Vite raw-source imports SHALL load their Markdown source without redirect interception. It SHALL NOT show Interactivity.

#### Scenario: Initial demo
- **WHEN** the demo loads
- **THEN** only A1 Account Button and A4 Account Dialog are available as buttons under Account alongside C1 mint controls, with empty Runtime Preview
- **AND** no filler cards, introduction, WIP badges, or empty categories appear
- **AND** Request Continue appears under Pay-to-play only after its operation is implemented

#### Scenario: Open current documentation in development
- **WHEN** a user activates Documentation from the Admin app served by Vite
- **THEN** the browser opens the standalone user-story route without duplicating the documentation path
- **AND** the page renders the current local user-story Markdown source

#### Scenario: Open documentation from the deployed Admin base
- **WHEN** a user activates Documentation from the Admin app under the `/blockchain-integration-service/admin/` base
- **THEN** the browser opens the matching documentation route under that same deployment base
- **AND** the documentation entry loads instead of the Admin index fallback

#### Scenario: Load the documentation source
- **WHEN** the documentation page imports its user-story Markdown through the development server
- **THEN** the raw source request succeeds without being redirected to the documentation page itself
- **AND** the rendered page contains the current user-story headings and table of contents
