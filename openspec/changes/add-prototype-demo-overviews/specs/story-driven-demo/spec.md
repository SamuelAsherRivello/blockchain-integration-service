# Spec Delta

## ADDED Requirements

### Requirement: Consistent demo Overview
Every implemented prototype sandbox route SHALL present an Overview section before its inputs. Overview SHALL contain Intro, Diagram, and Docs tabs, SHALL default to Intro, and SHALL retain the existing demo input, execution, source, loading, and output behavior below it.

#### Scenario: Open any prototype demo
- **WHEN** a user opens any of the 19 prototype demo routes
- **THEN** the first content section is Overview with Intro, Diagram, and Docs tabs
- **AND** the Intro tab is selected initially

#### Scenario: Switch Overview tabs
- **WHEN** the user selects Diagram or Docs
- **THEN** the selected tab content is shown without a page-level vertical scrollbar inside Overview
- **AND** the rest of the demo remains available below the Overview

### Requirement: Audience-facing demo introductions
Each prototype demo SHALL provide a short, demo-specific Intro sentence beginning with “Demonstrates” and describing the operation in language suitable for a broad audience.

#### Scenario: Read an Intro
- **WHEN** a user opens the Intro tab for a demo
- **THEN** the page-specific sentence explains what the demo demonstrates without requiring Arkade or SDK knowledge
- **AND** it does not claim an unavailable, simulated, or unverified outcome

### Requirement: Shared layered sequence diagrams
Each prototype demo SHALL provide an operation-specific sequence diagram using the fixed columns Bitcoin `(On-Chain L1)`, Arkade Operator `(Off-Chain L2)`, Arkade Wallet `(SDK L3)`, and Client `(L3)`. Columns unused by the real operation SHALL remain visible without fabricated connections.

#### Scenario: Render a standard diagram
- **WHEN** a user selects Diagram for a non-external-wallet demo
- **THEN** the four fixed columns appear in that left-to-right order with the confirmed parenthesized layer labels
- **AND** message lines describe only the real operation path

#### Scenario: Read-only or public-address operation
- **WHEN** the operation reads public state directly from the Arkade Operator
- **THEN** the diagram may connect Client directly to Arkade Operator
- **AND** Bitcoin Layer 1 and Arkade Wallet remain visible but unconnected when unused

### Requirement: External-wallet sequence diagrams
The two External Wallet demos SHALL use the four standard columns plus a rightmost External Wallet `(L3)` column, and SHALL show the wallet-link handoff without presenting the external wallet as the internal Arkade Wallet SDK.

#### Scenario: Open an External Wallet diagram
- **WHEN** a user selects Diagram for either External Wallet demo
- **THEN** the diagram shows External Wallet `(L3)` as the fifth rightmost column
- **AND** the handoff, callback, and resulting payment path are represented without claiming that the browser directly controls the external wallet

### Requirement: Existing documentation in Overview
The Docs tab for every demo SHALL contain the existing demo documentation body and link, preserving its current destination, topic, descriptions, and external-wallet guidance.

#### Scenario: Open demo Docs
- **WHEN** a user selects Docs in any demo Overview
- **THEN** the same documentation body and destination currently associated with that demo are displayed inside the tab
- **AND** no separate duplicate Docs section is rendered above the demo inputs

### Requirement: Overview layout and accessibility
Overview tab controls SHALL expose selected state and panel relationships to assistive technology. Each tab’s content SHALL size to its content; the diagram SHALL retain the established 400px canvas and horizontal overflow behavior where its fixed-width sequence requires it.

#### Scenario: Keyboard and narrow layout
- **WHEN** a user navigates Overview tabs with a keyboard or views the demo at a narrow width
- **THEN** the active tab is identifiable, the active panel is associated with its tab, and content remains readable without a vertical tab-panel scrollbar
