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

### Requirement: Feedback-directed source visual fidelity
The Blockchain For Game deck SHALL render the authorized source visuals for slides 3, 4, 5, and 30 at an upscaled resolution suitable for their displayed bounds. Slide 5 SHALL contain both required visuals, and slide 30 SHALL place its visual in the left pane of a cataloged image-left composition.

#### Scenario: Source visuals are rendered in their required compositions
- **WHEN** a reviewer opens slides 3, 4, 5, or 30 in the local Blockchain For Game route
- **THEN** each slide shows its authorized high-resolution source visual without distortion or clipping, slide 5 shows both visuals, and slide 30 shows its visual left of its text

### Requirement: Feedback-directed content and diagram geometry
The deck SHALL render slides 14 and 15 using the shared content treatment, with five top-level bullets on slide 14 and two subordinate bullets per top-level item on slide 15. Slides 10 through 12 SHALL render diagrams at 130 percent of their prior scale and 300 pixels lower while retaining all diagram content within the visible slide canvas.

#### Scenario: Reviewer inspects revised content and diagrams
- **WHEN** a reviewer opens slides 10 through 15 in the local Blockchain For Game route
- **THEN** the three diagrams are larger and lower without clipping, slide 14 presents five top-level bullets in one text field, and slide 15 presents those same bullets with two subordinate bullets for each

### Requirement: Whole-deck rendered visual review
The presentation workflow SHALL produce a Playwright-rendered inspection for every Blockchain For Game slide and retain the review artifacts under the repository-root `output/` directory. The review SHALL examine image bounds, diagram bounds, text overflow, and slide composition before the feedback change is accepted.

#### Scenario: Full deck review is executed
- **WHEN** the visual-feedback change is verified
- **THEN** every deck slide has a current rendered-review result and the review reports no unresolved image-size, diagram-size, clipping, or overflow defect

### Requirement: Google content deck conversion is complete
The Blockchain For Game Slidev deck SHALL contain one ordered counterpart for every slide in the configured Google content deck. The configured source currently contains 51 slides. Each counterpart SHALL declare the source slide number and Google object ID, preserve the source slide's substantive claim, and be reviewable against the source manifest.

#### Scenario: Reviewer verifies the source conversion
- **WHEN** a reviewer compares the Google source manifest with the Slidev deck
- **THEN** every source slide has exactly one counterpart in source order with matching metadata

### Requirement: Required source tables are editable Slidev content
The deck SHALL render slides 7, 8, 9, 42, and 43 as editable tables rather than source-table images. Slides 7 and 8 SHALL retain editable titles and headers with copied, upscaled visual body content; slide 9 SHALL use text-only body cells; slide 42 SHALL present the general Bitcoin layer comparison; and slide 43 SHALL present a game-oriented counterpart.

#### Scenario: Reviewer inspects the converted tables
- **WHEN** the listed Slidev slides are opened
- **THEN** their titles, headers, rows, and columns are represented as editable Slidev content and their required table treatments are visible

### Requirement: Required diagrams use shared editable compositions
The deck SHALL render custom editable diagrams for slides 10–12, 20–27, 31–33, and 37. Slides 20–27 SHALL use the cataloged right-diagram composition; slides 31–33 SHALL reuse one network diagram with white, gold, and gold-plus-red line treatments; and slide 11 SHALL include the reimagined Pac-Man, pellets, and ghost.

#### Scenario: Reviewer opens a diagram slide
- **WHEN** a reviewer opens a required diagram slide
- **THEN** the diagram has the declared composition and preserves the source slide's explanatory role without relying on a source screenshot

### Requirement: Image conversion treatment and resolution are auditable
The deck SHALL declare each source-image treatment as copied, reimagined, or intentionally omitted. Copied images SHALL be upscaled before use: small cell or logo assets at 4× and larger chart or artwork assets at 2×. Slides 10, 12, and 17–19 SHALL intentionally omit source images.

#### Scenario: Verification checks copied imagery
- **WHEN** verification encounters a slide with copied source imagery
- **THEN** it reports the treatment and confirms the declared 2× or 4× upscale category

#### Scenario: Verification checks omitted imagery
- **WHEN** verification encounters slides 10, 12, or 17–19
- **THEN** it confirms that no source image is rendered for that counterpart
