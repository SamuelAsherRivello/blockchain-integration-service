# Spec Delta

## MODIFIED Requirements

### Requirement: Existing documentation routes remain usable
The template catalog and Blockchain For Game deck SHALL remain available through
their established preview routes after the migration and throughout a supported
live-preview session.

#### Scenario: Preview is started after migration
- **WHEN** the Slidev documentation preview is running
- **THEN** both the Mondrian template route and the Blockchain For Game route render their respective decks

#### Scenario: Live-preview route is verified
- **WHEN** the stable local preview verifies a declared Mondrian documentation route
- **THEN** the route renders through the shared landing origin with the same shared layout selected by its source slide
