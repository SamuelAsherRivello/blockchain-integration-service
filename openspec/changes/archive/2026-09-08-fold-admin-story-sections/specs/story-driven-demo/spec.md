## ADDED Requirements

### Requirement: Foldable Admin story sections
Each lettered Admin story section A-F SHALL fold independently and SHALL start expanded on a fresh page load. Its title line SHALL show a decorative > chevron to the left, pointing right when folded and down when expanded. Title font size, weight and color SHALL match the User Stories heading. Folding SHALL hide the section story summary and controls while preserving their state and existing behavior. The documentation section and Console SHALL remain outside this folding behavior.

#### Scenario: Pointer folding
- **WHEN** a user activates a story section title
- **THEN** that section toggles between expanded and folded while other sections retain their current fold state
- **AND** the chevron reflects the new state

#### Scenario: Keyboard folding
- **WHEN** the title has keyboard focus and Enter or Space is pressed
- **THEN** its section toggles with a visible keyboard focus indicator

#### Scenario: Preserve state
- **WHEN** a user folds a section, another Admin action causes a rerender, and the section is reopened
- **THEN** folding survives the rerender and the existing child selection and controls remain intact

#### Scenario: Narrow layout
- **WHEN** the Admin panel is narrow
- **THEN** the chevron and matching title remain readable and expanded content remains in normal document flow
