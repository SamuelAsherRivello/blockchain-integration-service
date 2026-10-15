## ADDED Requirements

### Requirement: Shared form network and BIS version header
Every production BIS form displaying Network: Signet SHALL retain that network label centered horizontally relative to its form. It SHALL display `BIS: v<version>` immediately to the right on the same header line, vertically aligned with the network text, using the running @bis/integration package version. The version SHALL be very faded relative to the network label while remaining visible. The network label SHALL NOT shift to center the combined pair. Existing sticky header behavior SHALL remain intact.

#### Scenario: Open a production form
- **WHEN** a user opens any production form with the network header
- **THEN** Network: Signet remains centered in the form
- **AND** the running BIS version appears immediately to its right in very faded text
- **AND** the version has a lowercase v prefix and does not introduce an interactive control

#### Scenario: Package version changes
- **WHEN** a different integration package version is built and loaded
- **THEN** its header displays that package version automatically without editing a hardcoded UI version
- **AND** development source and built-library consumers follow the same version source

#### Scenario: Narrow preview and scrolling
- **WHEN** a form appears in the supported narrow portrait preview or its body scrolls
- **THEN** both labels remain visible without overlap or horizontal overflow
- **AND** the network stays centered and the strip retains its sticky behavior
