# slidev-theme-layout-contract Specification

## Purpose

Ensure the Mondrian presentation system exposes reusable Slidev layouts and that content decks render through those same layouts rather than visually drifting from template examples.

## Requirements

### Requirement: Mondrian theme supplies presentation layouts
The presentation system SHALL provide the Mondrian visual system as one local Slidev theme with named layouts for every supported catalog composition. A layout SHALL accept deck-specific content through Slidev content or slots without requiring a deck to duplicate the layout's structural styling.

#### Scenario: Deck selects a shared layout
- **WHEN** a Slidev deck selects a named Mondrian layout in slide frontmatter
- **THEN** Slidev renders that slide with the structure and visual rules supplied by the local Mondrian theme

### Requirement: Template deck is the layout catalog
The Mondrian template deck SHALL render a representative example for every layout supported for content-deck use. Each example SHALL identify the layout it demonstrates so authors can compare a content slide with its canonical composition.

#### Scenario: Author reviews supported layouts
- **WHEN** an author opens the Mondrian template deck
- **THEN** the deck presents each supported reusable layout as a visible example

### Requirement: Content deck uses cataloged layouts
The Blockchain For Game deck SHALL select only named Mondrian theme layouts represented by the template deck for its shared slide compositions. Its slide content SHALL be supplied separately from the theme layout structure.

#### Scenario: Content slide has a template mapping
- **WHEN** a Blockchain For Game slide declares a template/style mapping
- **THEN** its selected Slidev layout is the shared Mondrian layout represented by that template example

### Requirement: Template mapping is auditable
The system SHALL provide a reviewable mapping from every Blockchain For Game slide that identifies a template/style reference to the actual shared layout it renders. A mapping SHALL not claim a template composition that the slide does not use.

#### Scenario: Reviewer follows a style reference
- **WHEN** a reviewer opens a content slide's template/style reference
- **THEN** the referenced template example and the content slide use the same named shared layout

### Requirement: Existing documentation routes remain usable
The template catalog and Blockchain For Game deck SHALL remain available through their established preview routes after the migration.

#### Scenario: Preview is started after migration
- **WHEN** the Slidev documentation preview is running
- **THEN** both the Mondrian template route and the Blockchain For Game route render their respective decks

### Requirement: Local landing page supports human approval
The local documentation landing page SHALL provide navigable routes to the Modrian Template catalog and the Blockchain For Gaming deck so a reviewer can approve the rendered relationship between them.

#### Scenario: Reviewer opens the local landing page
- **WHEN** the local Slidev documentation server is running
- **THEN** the landing page provides links to both the Modrian Template and Blockchain For Gaming decks

### Requirement: Definition-of-done mapping enforcement
The system SHALL treat the refactor as incomplete if any Blockchain For Gaming slide uses a layout not showcased by the Modrian Template catalog or uses a theme other than the custom Mondrian theme.

#### Scenario: Blockchain slide selects an uncataloged layout
- **WHEN** verification finds a Blockchain For Gaming slide whose layout is absent from the Modrian Template catalog
- **THEN** verification reports failure and human approval is withheld

#### Scenario: Blockchain deck uses a different theme
- **WHEN** verification finds a Blockchain For Gaming slide or deck configured with a theme other than the custom Mondrian theme
- **THEN** verification reports failure and human approval is withheld
