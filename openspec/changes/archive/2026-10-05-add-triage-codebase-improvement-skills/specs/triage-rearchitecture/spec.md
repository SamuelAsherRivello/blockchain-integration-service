# Spec Delta

## Purpose

Turn one selected, evidence-backed architecture concern into a bounded, behavior-preserving refactor with explicit user control.

## ADDED Requirements

### Requirement: Rearchitecture selects one bounded candidate
The system SHALL require a user-selected architecture candidate before planning or applying a refactor. It SHALL revalidate the candidate against the current repository, selected scope, standards baseline, and applicable prior reports before relying on earlier evidence.

#### Scenario: Candidate selection
- **WHEN** an analysis report contains multiple architecture opportunities
- **THEN** the system asks the user to select one candidate before creating a refactor plan

#### Scenario: Stale candidate
- **WHEN** the selected candidate's commit, scope, or relevant standards have changed since its report
- **THEN** the system refreshes the architecture analysis before planning changes

### Requirement: Rearchitecture plans relationships rather than cosmetic cleanup
The system SHALL analyze module and object responsibilities, public contracts, state ownership, dependency direction, seams, coupling, and verification surfaces. It SHALL not use rearchitecture to perform unrelated naming, ordering, or file-placement cleanup.

#### Scenario: Ownership conflict
- **WHEN** two modules appear to own the same mutable state
- **THEN** the plan identifies the ownership decision, affected contracts, and validation needed before implementation

#### Scenario: Cosmetic drift
- **WHEN** a candidate only concerns filenames, folder placement, or class member ordering
- **THEN** the system recommends Standardize rather than Rearchitect

### Requirement: Rearchitecture uses an explicit plan-and-apply gate
The system SHALL produce a staged, independently verifiable refactor plan that identifies contracts, migration order, behavior-preservation checks, and rollback considerations. It SHALL require explicit user approval before applying the selected refactor.

#### Scenario: Plan approval withheld
- **WHEN** the user does not explicitly approve the rearchitecture plan
- **THEN** the system does not modify implementation code

#### Scenario: Approved refactor
- **WHEN** the user explicitly approves the selected plan
- **THEN** the system implements only that candidate and runs the plan's contract, integration, and available repository verification checks

### Requirement: Rearchitecture supports optional planning integration
The system SHALL offer an optional OpenSpec handoff for a selected candidate and an optional local Grill Me interview for material unresolved decisions. It SHALL not require OpenSpec, create an OpenSpec change automatically, or invoke Grill Me without user acceptance.

#### Scenario: Optional OpenSpec promotion
- **WHEN** a user wants durable planning for a selected candidate
- **THEN** the system provides the candidate's scope, evidence, non-goals, and unresolved decisions for a user-invoked OpenSpec proposal

#### Scenario: Material design doubt
- **WHEN** an unresolved ownership, contract, or migration decision prevents a safe plan
- **THEN** the system offers a focused Grill Me interview when locally available and incorporates accepted answers before resuming
