# Spec Delta

## MODIFIED Requirements

### Requirement: Existing documentation routes remain usable
The template catalog and Blockchain For Game deck SHALL remain available through
their established preview routes after the migration. Each local preview link
SHALL use the canonical deck-base pathname with one hash-based slide position
and SHALL not duplicate the slide position in its pathname.

#### Scenario: Preview is started after migration
- **WHEN** the Slidev documentation preview is running
- **THEN** both the Mondrian template route and the Blockchain For Game route render their respective decks
- **AND** their generated local links contain one hash-based slide position and no pathname slide suffix
