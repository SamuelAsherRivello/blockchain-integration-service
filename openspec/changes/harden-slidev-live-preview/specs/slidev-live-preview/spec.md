# Spec Delta

## Purpose

Provide a reliable local Slidev runtime where every declared deck remains
reachable, editable, and provably synchronized with its rendered slides.

## ADDED Requirements

### Requirement: One declared live-preview inventory
The system SHALL derive the landing routes, editor ownership, supervision set,
and verification set from one declared inventory of supported Slidev previews.

#### Scenario: A declared preview is started
- **WHEN** an author starts the stable local preview
- **THEN** every preview declared in the inventory is supervised and available through its declared landing route

#### Scenario: Inventory and landing diverge
- **WHEN** a declared preview lacks a landing route or a landing route lacks an inventory entry
- **THEN** startup verification fails with the affected route and declaration identified

### Requirement: Optional consolidated preview ownership
The runtime MAY serve the landing page and multiple declared deck routes from
one local server only when every route retains its manifest-declared source,
editor ownership, generated-module identity, and HMR isolation. Until that
contract is verified, the runtime SHALL retain the independent deck servers.

#### Scenario: A consolidated runtime is evaluated
- **WHEN** maintainers enable a consolidated local runtime candidate
- **THEN** every declared route, editor save, HMR connection, and source-to-render coherence check succeeds without cross-deck ownership
- **AND** a failed deck route can be recovered without interrupting unrelated declared routes

#### Scenario: Consolidation fails isolation verification
- **WHEN** a consolidated runtime candidate routes an editor save, generated module, or HMR connection to the wrong deck
- **THEN** verification rejects the candidate and the independent deck runtime remains available

### Requirement: Twelve-hour self-healing local session
The stable local preview SHALL run for a configurable duration of at least 12
hours, retain ownership evidence for each project process, and recover a failed
declared listener without an external visible terminal window.

#### Scenario: A deck listener stops
- **WHEN** a declared deck listener exits or ceases to serve its readiness route during a stable session
- **THEN** the runtime restores that deck and its landing route within 60 seconds while preserving healthy project listeners

#### Scenario: The landing listener stops
- **WHEN** the landing listener exits or ceases to serve its readiness route during a stable session
- **THEN** the runtime restores the landing page within 60 seconds without waiting for unrelated deck recovery

#### Scenario: A port belongs to another application
- **WHEN** a required preview port is occupied by a process not owned by the local preview runtime
- **THEN** the runtime leaves that process untouched and reports a blocking ownership conflict

### Requirement: Live connection readiness
The runtime SHALL verify that each proxied Slidev route establishes its required
development connection as well as returning an HTTP document.

#### Scenario: A proxied deck opens
- **WHEN** a browser opens a declared deck through the landing origin
- **THEN** the page renders its Slidev document and establishes a usable live-reload connection to its owning deck server

#### Scenario: The live connection drops
- **WHEN** a deck's live-reload connection is interrupted
- **THEN** the browser reconnects or reloads the affected route after the deck recovers, without navigating to a different deck or slide

### Requirement: Browser editor preserves the correct deck source
The Slidev browser editor SHALL read and save the active deck's slide record
through the landing origin without treating navigation-state acknowledgements as
source edits.

#### Scenario: Author edits a master-deck slide
- **WHEN** an author saves a slide through the master-deck browser editor
- **THEN** the edit is persisted to the master-deck source and the editor response is not served from an earlier HTTP cache entry

#### Scenario: Author edits another declared deck
- **WHEN** an author saves a slide through another declared deck's browser editor
- **THEN** the request is routed to that deck's source rather than the master deck

#### Scenario: Slidev persists navigation state
- **WHEN** Slidev posts reactive navigation state through a proxied route
- **THEN** the runtime acknowledges it without modifying presentation source content

### Requirement: Source-to-render coherence
For every declared slide, the runtime SHALL verify that the source-derived editor
record, generated slide module, and visible browser route represent the same
slide revision and content identity.

#### Scenario: Normal slide rendering
- **WHEN** coherence verification visits a declared slide
- **THEN** its browser route, editor record, and generated render module identify the same slide number, revision, and content fingerprint

#### Scenario: A generated module is stale
- **WHEN** coherence verification finds a generated module that represents a different slide than its editor record
- **THEN** the runtime regenerates only the affected deck process, re-verifies the route, and reports the recovery without modifying authored slide content

### Requirement: Bounded live edit-to-render propagation
The supported live-editing workflow SHALL prove that a persisted slide-source
change appears on the matching rendered route within five seconds.

#### Scenario: Safe round-trip verification
- **WHEN** the live-preview verification performs its isolated editor round-trip fixture
- **THEN** the fixture edit is persisted, rendered on the matching route within five seconds, and removed or restored without changing authored presentation content

#### Scenario: Propagation exceeds the budget
- **WHEN** a persisted fixture edit does not reach the matching rendered route within five seconds
- **THEN** verification fails with the deck, slide, editor revision, render revision, and connection evidence

### Requirement: Actionable runtime evidence
The runtime SHALL expose current health and recovery status and retain
non-secret diagnostic evidence under the repository `output/` directory.

#### Scenario: Author checks preview status
- **WHEN** an author requests stable-preview status
- **THEN** the result identifies each declared route, process ownership state, last successful coherence check, and any active recovery

#### Scenario: Verification detects a failure
- **WHEN** a health, connection, editor, or coherence check fails
- **THEN** the result names the affected deck and slide and points to non-secret logs or reports needed to diagnose it

### Requirement: Focused author operations preserve the stable preview
The supported author workflow SHALL start or reuse the manifest-supervised
preview before invoking the focused skill for a slide move, duplication, edit,
rename, creation, content-linking, template/deck resynchronization, or layout
synchronization. Each operation SHALL preserve the selected deck identity and
leave healthy supervised listeners running. When the preview is available, the
affected route SHALL remain reachable after the operation.

#### Scenario: A structural slide operation runs during a stable session
- **WHEN** an author moves or duplicates a slide through its focused skill while the stable preview is running
- **THEN** the operation preserves the complete slide source block and verifies the requested final route position
- **AND** the supervisor and unrelated healthy deck listeners remain running
- **AND** the affected proxied route remains reachable

#### Scenario: A content or synchronization operation runs during a stable session
- **WHEN** an author invokes a focused edit, rename, create, linking, template/deck resynchronization, or layout-synchronization skill
- **THEN** the operation uses the selected deck's declared ownership and does not replace the shared preview runtime
- **AND** a failure reports the affected deck and leaves unrelated listeners available

### Requirement: Repeatable reliability verification
The project SHALL provide automated unit, integration, browser, and configurable
duration soak verification for the live-preview contract.

#### Scenario: Full-duration soak run
- **WHEN** maintainers run the 12-hour soak profile
- **THEN** it records route availability, reconnects, recoveries, and coherence results for the complete declared inventory

#### Scenario: Fast verification run
- **WHEN** maintainers run the development verification profile
- **THEN** it exercises the same checks with a shorter duration and produces the same evidence format
