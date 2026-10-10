# multi-package-development Specification

## Purpose
Provide a single development server for every BIS package, with browser applications where available and linked package documentation otherwise.

## Requirements

### Requirement: Single server with four destinations

The root `npm run dev` command SHALL start one Vite server on loopback port 5174 by default and print four URLs on that origin. `/admin/`, `/marketplace/`, and `/onboarding/` SHALL load their respective existing applications; `/integration/` SHALL render the integration README. An occupied requested port SHALL cause startup failure rather than silently change the port.

#### Scenario: Open all package destinations
- **WHEN** a developer starts the root development command and opens each printed URL
- **THEN** three distinct applications and the integration README load on the same server and port
- **AND** no separate Vite server is needed for another package

#### Scenario: Port is already occupied
- **WHEN** the requested development port is unavailable
- **THEN** startup fails and does not advertise a different port as successful

### Requirement: Correct package resources and live sources

Each app SHALL load its own entry modules and public assets under the shared server. Marketplace catalog requests and Admin documentation/book routes SHALL retain their behavior. Vite source updates SHALL remain available, raw Markdown imports SHALL remain raw, and an unknown app path SHALL NOT fall back to a different app.

#### Scenario: Marketplace and documentation requests
- **WHEN** Marketplace loads its catalog and a user opens Admin documentation
- **THEN** Marketplace receives catalog JSON and documentation renders its current Markdown source rather than another application's HTML

#### Scenario: Unknown application path
- **WHEN** a visitor requests a nonexistent file beneath an application route
- **THEN** the server returns not found rather than another application's entry page

### Requirement: Linked package documentation

The main README SHALL retain its Packages section with External Packages containing the existing external links and Internal Packages containing one link to each of the four package READMEs. Each package README SHALL explain the package and link back to the main README. The integration development destination SHALL present readable Markdown with a working link to the main README and SHALL NOT initialize a wallet UI.

#### Scenario: Read a package and return
- **WHEN** a reader follows an Internal Packages link and then its main README link, on GitHub or the development server
- **THEN** the matching package documentation and main README are reachable

### Requirement: Four-URL agent handoff

The repository guidance SHALL define `run vite` as starting or reusing the shared development server, checking all four destinations for successful responses and their expected content, and returning four links. For remote previews it SHALL retain server port 5174, Windows tunnel port 15174, and the existing single-line SSH tunnel command when a tunnel is needed. Server verification SHALL be distinguished from client tunnel verification.

#### Scenario: Remote preview request
- **WHEN** the user asks the agent to run Vite on the remote server
- **THEN** the handoff provides `/admin/`, `/marketplace/`, `/onboarding/`, and `/integration/` under `http://127.0.0.1:15174/` after verifying the remote destinations

### Requirement: Existing production and persistence contracts remain compatible

Package production builds and the two published GitHub Pages routes SHALL remain functional. The development server SHALL preserve existing BIS and standalone storage namespaces without automatically migrating saved wallets from other origins.

#### Scenario: Shared origin and separate old ports
- **WHEN** Admin and Marketplace run on the shared origin
- **THEN** they use the existing BIS storage namespaces on that origin
- **AND** the standalone spike retains its independent storage namespaces and saved data on other ports is not copied or deleted
