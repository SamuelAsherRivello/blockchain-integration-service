# Spec Delta

## ADDED Requirements

### Requirement: Content deck correspondence is complete and ordered
The Blockchain For Game Slidev deck SHALL contain one slide for every slide in the configured Google content deck, in identical source order. Each Slidev slide SHALL declare its source slide number and Google slide object ID, and shall present the source slide's substantive text, table, or diagram content without substituting a different claim.

#### Scenario: Reviewer checks the deck against its source
- **WHEN** a reviewer compares the Slidev deck metadata with the configured Google content deck
- **THEN** every source slide has exactly one ordered Slidev counterpart with matching source number and object ID

#### Scenario: Source slide contains an editable table
- **WHEN** a source slide contains a table
- **THEN** its Slidev counterpart presents every source row and column value without omission

### Requirement: Source image treatment is auditable
The Blockchain For Game deck SHALL declare the treatment of every source slide that contains a native image as either `copy image` or `reimagine image`. A copied image SHALL preserve the source visual; a reimagined image SHALL retain the original visual's explanatory role and shall be identified in the slide's review metadata.

#### Scenario: Source slide contains a native image
- **WHEN** verification identifies a source slide with one or more native images
- **THEN** its Slidev counterpart declares an image treatment and verification reports the selected treatment

#### Scenario: Source slide has no native image
- **WHEN** verification identifies a source slide without a native image
- **THEN** no image-treatment declaration is required for that counterpart
