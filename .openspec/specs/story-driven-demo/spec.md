# story-driven-demo Specification

## Purpose

Keep the demo a lean, truthful navigator of available integration demonstrations with explicit production boundaries and synchronized story documentation.

## Requirements

### Requirement: Demo identification and preview framing
The demo SHALL display "Blockchain Integration Service - Demo" in its header, a version prefixed with "v", and a GitHub icon linking to the repository. The panels SHALL be labeled "Admin" and "Runtime Preview" with matching heading typography. An empty preview SHALL show a centered demo-owned "Game Viewport" placeholder, hidden when production content is rendered.

#### Scenario: Empty preview identification
- **WHEN** the demo starts or Reset Client clears runtime content
- **THEN** the Game Viewport placeholder is visible and no production Account button is shown

### Requirement: Preview content scale
The demo SHALL offer 100%, 50%, and 25% content scale beside the 9:16 indicator, defaulting to 50%. Scaling SHALL keep the outer frame fixed, give the production mount region inversely proportional layout dimensions, and scale the DOM presentation to fit. It SHALL NOT require production styling changes or remount/reset the current account flow.

#### Scenario: Change scale with dialogue open
- **WHEN** a user changes the preview scale while the Account dialogue is open
- **THEN** the dialogue remains open and centered, its content scales, and its enabled controls remain interactive

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and categories containing at least one such demonstration. It SHALL start without a selected story. This slice SHALL expose Account / Account Button and omit Pay-to-play and Achievements.

The Admin heading SHALL be followed by a User Stories heading and a Documentation link to the bundled user-story Markdown, then the Account category and Account Button story action. It SHALL NOT show an Interactivity heading. The documentation link SHALL work in development and in the built demo.

#### Scenario: Initial demo
- **WHEN** the demo loads
- **THEN** Account Button is available under Account and Runtime Preview UI content is empty
- **AND** no filler cards, introduction, WIP badges, or empty categories appear

### Requirement: Production controls and state
Selecting Account Button SHALL render the real production entry button through the supported public UI surface. The Runtime Preview UI SHALL use only production APIs and components. Admin SHALL observe production context state first and SHALL NOT introspect for unimplemented APIs.

#### Scenario: Open through real UI
- **WHEN** the user selects Account Button and clicks the rendered button
- **THEN** the production chooser appears and the Admin UI story action is disabled while it is open
- **AND** closing the dialogue enables the story action again

### Requirement: Reset clears selection and transient state
Reset Client SHALL reset transient demo/integration state, clean up the old client/UI, preserve persisted data, clear the selected story, and leave runtime content empty. Admin-only controls SHALL NOT bypass security or fabricate wallet outcomes.

#### Scenario: Clear selected story
- **WHEN** Reset Client is used while the Account dialogue is shown
- **THEN** a fresh client has no selected story and presents no Account button
- **AND** persisted data is unchanged and old subscriptions are released

#### Scenario: No selected story
- **WHEN** the demo has no selected story
- **THEN** Reset Client is disabled

### Requirement: Visually distinct package-owned styles
Demo-owned page/navigation/frame styling SHALL remain dark. Production integration content SHALL use an independently owned light visual design. Demo styling SHALL NOT override production component styling.

#### Scenario: Independent host
- **WHEN** the production UI is mounted in a plain host without demo CSS
- **THEN** its typography, colors, sizing, and behavior remain usable and visually consistent

### Requirement: User stories remain truthful
User-story documentation SHALL retain stable IDs and distinguish complete, partial, and planned behavior. Each new runtime feature SHALL include a corresponding Admin UI demonstration and synchronized documentation before being reported complete. The A1 diagram SHALL cover only no-profile opening and Back; the A4 diagram SHALL own active-profile opening. Stories SHALL be split explicitly when too broad, with remaining work preserved as named stories.

#### Scenario: First slice delivered
- **WHEN** this feature is documented as delivered
- **THEN** documentation maps A1 to Account Button and explains its supported path
- **AND** it does not claim account creation, restoration, or the full active-profile path works



