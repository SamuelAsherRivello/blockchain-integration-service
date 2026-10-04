# Spec Delta

## ADDED Requirements

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
