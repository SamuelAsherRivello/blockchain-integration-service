# triage-standardization Specification

## Purpose

Establish a project-owned standardization baseline and safely bring repository structure, class contracts, and AI readiness into conformance with it.

## Requirements

### Requirement: Standardization ships an editable active baseline
The system SHALL ship a complete language-agnostic standards document containing Project, Class, AI-Readiness, score-weight, exception, and deferred-decision sections. It SHALL use that document as the active baseline immediately and allow users to edit it in place; it SHALL not require or create a second project-copy baseline.

#### Scenario: First standardization run
- **WHEN** a user invokes Standardize with an uncustomized shipped standards document
- **THEN** the system uses its complete default Project, Class, AI-Readiness, score-weight, and known-exception sections to calculate the delta without requiring setup approval

#### Scenario: Advanced user modifies the baseline
- **WHEN** a user edits the shipped standards document
- **THEN** later Standardize runs use the edited document as the source of truth

### Requirement: Standardization compares three conformance dimensions
The system SHALL assess project structure, class/object-oriented contract shape, and AI readiness against the approved baseline. It SHALL report the evidence-backed delta before making changes and SHALL distinguish structural conformity from architecture redesign.

#### Scenario: Project structure drift
- **WHEN** a file or folder violates an approved placement or naming convention
- **THEN** the system includes the expected and actual structure in the standardization delta

#### Scenario: Class contract drift
- **WHEN** a class or language-equivalent object violates an approved responsibility, visibility, construction, or contract expectation
- **THEN** the system reports the violation without requiring a language-specific syntax rule

#### Scenario: Architecture concern found during standardization
- **WHEN** conforming a structure would require changing ownership, interfaces, or dependency direction
- **THEN** the system defers the concern to an Architecture follow-up rather than silently redesigning it

### Requirement: Standardization assesses AI readiness
The system SHALL assess canonical agent context, discoverable commands, structural orientation, definition-of-done guidance, reusable maintenance knowledge, and safe agent-operation boundaries. It SHALL report each applicable item as nailed, partial, missing, or not applicable.

#### Scenario: Missing AI ignore policy
- **WHEN** a repository has no `.aiignore`
- **THEN** the system offers a reviewed project-specific draft and does not create it without approval

#### Scenario: Duplicated agent instructions
- **WHEN** tool-specific instruction files duplicate or conflict with canonical agent context
- **THEN** the system identifies the drift and proposes consolidation through the approved baseline

### Requirement: Standardization requires explicit application approval
After a baseline is approved, the system SHALL show the exact low-risk conformity delta and require explicit user confirmation before modifying source, structure, documentation, or configuration. It SHALL not apply changes that alter intended behavior or require architecture decisions.

#### Scenario: Approved low-risk delta
- **WHEN** the user explicitly approves a displayed low-risk standardization delta
- **THEN** the system applies only the approved changes and runs the relevant available verification

#### Scenario: Unapproved delta
- **WHEN** the user does not explicitly approve the displayed delta
- **THEN** the system leaves the repository unchanged

### Requirement: Standardization preserves reusable decisions
The system SHALL use its editable shipped standards document to retain templates, score weights, known exceptions, and deferred decisions. It SHALL treat ignored report packets as diagnostic snapshots and SHALL offer optional OpenSpec or Grill Me handoffs without requiring either workflow.

#### Scenario: Approved exception
- **WHEN** a current deviation matches an approved exception
- **THEN** the system reports the exception without treating it as a newly actionable violation
