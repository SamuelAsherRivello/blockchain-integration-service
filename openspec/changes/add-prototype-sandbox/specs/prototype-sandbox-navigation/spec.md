# Spec Delta

## Purpose

Provides a development-only collection of standalone demo pages that share a consistent Prototype Faucet presentation and allow developers to move between future experiments quickly.

## ADDED Requirements

### Requirement: Sandbox exposes ten standalone demo entry points
The Sandbox SHALL expose directly addressable pages for Demo 1 through Demo 10 under the Prototype Sandbox route.

#### Scenario: Direct demo entry
- **WHEN** a developer opens `/prototype-sandbox/demo-4/`
- **THEN** the page loads Demo 4 as the active demo without requiring a prior visit to another Sandbox page

#### Scenario: All demo routes exist
- **WHEN** a developer opens each route from `/prototype-sandbox/demo-1/` through `/prototype-sandbox/demo-10/`
- **THEN** every route renders a valid Sandbox page with its corresponding demo active

### Requirement: Every demo uses the shared Prototype Faucet header
Each Sandbox page SHALL render the same title bar identity and network selector presentation used by Prototype Faucet.

#### Scenario: Shared header presentation
- **WHEN** a developer opens any Sandbox demo
- **THEN** the page displays the `BIS - Prototype Faucet` title and a Signet/Mutinynet network dropdown with matching styling

#### Scenario: Network selection
- **WHEN** a developer changes the selected network
- **THEN** the shared selector applies the same network-switch behavior as Prototype Faucet and the selected network remains visible

### Requirement: Navigation lists every demo and marks the active demo
Each Sandbox page SHALL display a horizontal Navigation section containing one control for every demo, with the active demo non-interactive.

#### Scenario: Active navigation item
- **WHEN** Demo 4 is active
- **THEN** Navigation displays Demo 4 as disabled or otherwise non-clickable, while Demo 1 through Demo 3 and Demo 5 through Demo 10 remain actionable

#### Scenario: Navigate between demos
- **WHEN** a developer activates a different demo control
- **THEN** the browser navigates to that demo's dedicated route and the newly selected control becomes non-interactive

### Requirement: Initial demo bodies remain empty
The initial Sandbox pages SHALL contain no demo-specific content below the shared header and Navigation section.

#### Scenario: Empty demo shell
- **WHEN** a developer opens any Sandbox demo
- **THEN** the page contains the shared title bar and Navigation section only, with no Faucet form, Arkade operation, or placeholder demo behavior
