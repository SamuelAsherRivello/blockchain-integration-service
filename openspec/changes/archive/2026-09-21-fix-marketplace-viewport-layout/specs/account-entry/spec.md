## MODIFIED Requirements

### Requirement: Host-mounted production presentation
The integration SHALL render into a supplied host container, initially empty, and SHALL offer an explicit request to display a production Account button. Production content SHALL be centered within that container by default. A consuming host MAY apply host-local placement styling to the closed Account button, provided it does not transform or reduce the host overlay layer and an open Account dialogue remains centered within the complete host container. The entry button SHALL size to its content; dialogue action buttons SHALL share the same width and padding. Production UI SHALL not depend on demo code or styles.

#### Scenario: Display entry control

- **WHEN** a host mounts integration UI and requests Account button presentation
- **THEN** one centered production Account button appears in that container by default
- **AND** no simulated game settings or navigation is added

#### Scenario: Host positions its entry control

- **WHEN** a consuming host applies a host-local Account button position
- **THEN** the closed entry control appears at that visible host-local position
- **AND** opening Account still covers and centers in the complete host container

#### Scenario: Open directly from host UI

- **WHEN** a host mounts the production UI and calls the public context.openAccountDialog() method without requesting an Account button
- **THEN** the same Account dialogue opens without requiring the BIS entry button
- **AND** Back restores the previously empty production layer
