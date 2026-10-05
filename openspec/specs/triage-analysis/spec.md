# triage-analysis Specification

## Purpose

Provide a read-only repository assessment that gives maintainers evidence-backed, reusable direction before standardization or architecture work begins.

## Requirements

### Requirement: Triage analysis produces a bounded report packet
The system SHALL analyze either a user-named scope or the whole repository by default without modifying production code. It SHALL write a timestamped Markdown packet beneath the repository's configured ignored report location, including an overview, Standardization analysis, Architecture analysis, and verification baseline.

#### Scenario: Whole-repository analysis
- **WHEN** a user invokes analysis without naming a scope
- **THEN** the system creates a report packet covering the repository and identifies its run identifier, commit, scope, and evidence confidence

#### Scenario: Focused analysis
- **WHEN** a user names a module, feature, or standardization/architecture focus
- **THEN** the system limits its findings to that scope while recording the chosen scope in the report

### Requirement: Triage analysis presents two primary health categories
The overview SHALL present Standardization Health and Architecture Health as the two primary scored categories, plus an Overall Repository Health meter. The overall score SHALL default to an equal blend of the two categories and SHALL disclose any user-configured weights and unavailable inputs.

#### Scenario: Default scoring
- **WHEN** no project-specific score weighting is configured
- **THEN** the overview displays Standardization and Architecture scores and calculates Overall Repository Health with equal weights

#### Scenario: Uncustomized shipped standard
- **WHEN** the active shipped standards document remains uncustomized
- **THEN** the report identifies that default state and scores observed conformance without assigning an unsupported zero score

### Requirement: Triage analysis reuses and revalidates prior evidence
The system SHALL compare applicable prior report packets and approved deferred decisions with current repository evidence. It SHALL classify prior findings as resolved with evidence, still present, worsened, not re-observed, or intentionally deferred; absence from a later report SHALL NOT alone mark a finding resolved.

#### Scenario: Deferred finding remains relevant
- **WHEN** a prior approved deferred finding still matches current evidence
- **THEN** the new overview lists it as deferred and identifies its recorded rationale or review trigger

#### Scenario: Prior finding is no longer observed
- **WHEN** a prior finding is not found in the current analysis and no verification evidence confirms resolution
- **THEN** the report labels it not re-observed rather than resolved

### Requirement: Triage analysis identifies repository-integrity candidates safely
The system SHALL perform a read-only repository-integrity scan within Standardization analysis when the selected scope permits. It SHALL cross-check documentation claims, named targets, imports/references, manifests, build/runtime entry points, tests, scripts, configuration, and assets as applicable. It SHALL classify findings as confirmed stale, orphan candidate, intentionally future-facing, not assessed, or not applicable; it SHALL not infer removability from a single static non-reference.

#### Scenario: Future-facing documentation
- **WHEN** documentation is explicitly labeled Planned, Proposed, Roadmap, Future, historical, or equivalent
- **THEN** the system classifies it as intentionally future-facing rather than stale solely because it is not implemented

#### Scenario: Unreferenced code or asset
- **WHEN** static inspection finds no in-repository reference to code, an export, a script, configuration, or an asset
- **THEN** the system reports an orphan candidate with evidence limits and routes any approved cleanup to Standardize or Rearchitect as appropriate

### Requirement: Triage analysis protects excluded material
The system SHALL read an applicable `.aiignore` before broad exploration and SHALL exclude matching paths from reading, analysis, quotation, modification, and evidence collection. It SHALL identify excluded paths only as safe aggregate metadata and SHALL request an allowed location if the configured report destination is excluded.

#### Scenario: Excluded path during analysis
- **WHEN** a source path matches `.aiignore`
- **THEN** the report treats that path as out of scope and does not assess it as missing or nonconforming

#### Scenario: Excluded report destination
- **WHEN** the selected report directory matches `.aiignore`
- **THEN** the system does not write a report and asks the user to supply an allowed destination

### Requirement: Triage analysis offers optional follow-up paths
The report SHALL recommend, without automatically invoking, applicable Standardize, Rearchitect, OpenSpec, or Grill Me follow-ups. If material uncertainty prevents a safe conclusion and a local Grill Me skill is available, the system SHALL offer a focused interview and resume the originating workflow after the user accepts.

#### Scenario: Selected finding can become an OpenSpec change
- **WHEN** a report identifies a bounded standardization or architecture finding
- **THEN** it provides an optional OpenSpec handoff summary without creating an OpenSpec change

#### Scenario: Material uncertainty blocks recommendation
- **WHEN** an unanswered decision would change scope, safety, architecture, template rules, or acceptance criteria
- **THEN** the system explains the uncertainty and offers Grill Me only after confirming local availability
