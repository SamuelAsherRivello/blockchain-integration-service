# Spec Delta

## ADDED Requirements

### Requirement: bis-server shares the local Vite origin
The root development command SHALL serve bis-server through the existing Vite listener beside current package routes. Development Signet Server clients SHALL use the local handler without a required second API daemon. Mutinynet Local SHALL not depend on that handler. Disabling the signer SHALL preserve browser applications, keep Signet in Server with unavailable health and Retry, and retain ordinary Local Mutinynet actions.

#### Scenario: Local testing and debugging
- **WHEN** the developer runs the shared Vite server with signer configuration
- **THEN** the existing applications and signer API work on the same listener
- **AND** disabling the signer keeps Signet in Server with unavailable health and Retry while Mutinynet Local create/restore/login continues without BIS requests

### Requirement: Environment-dependent backend selection
Development Signet Server builds SHALL use their known local API or explicit development override; published Signet Server builds SHALL use the configured Vercel URL. The game development host SHALL reach the same local signer through documented middleware or proxy configuration. Mutinynet SHALL select Local before endpoint or remembered-server resolution in both environments. Server signing secrets SHALL never be browser configuration.

#### Scenario: Local and published clients
- **WHEN** the same integration release is used in development and on Pages
- **THEN** Signet selects the appropriate local or hosted Server endpoint without source edits, while Mutinynet enters Local without a BIS endpoint request
- **AND** development does not silently use the production signer

### Requirement: Server environment isolation and documentation
bis-server SHALL supply a blank environment template and named package README linked from the root README and development renderer. Populated environment files SHALL be ignored and inaccessible through direct, raw-import and encoded traversal requests. Server signer modules and secrets SHALL NOT enter browser bundles or Pages artifacts.

#### Scenario: Secret serving attempts
- **WHEN** a browser requests private configuration or server-only source through alternate resource paths
- **THEN** the private content is denied
- **AND** safe package documentation remains readable without creating a browser signer
