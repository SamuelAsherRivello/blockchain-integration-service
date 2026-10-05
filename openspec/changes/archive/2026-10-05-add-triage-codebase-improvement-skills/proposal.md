# Proposal

## Why

This repository needs reusable, language-agnostic skills that turn an unfamiliar or drifting codebase into evidence-backed standardization and architecture work without conflating a report with a rewrite. The skills will be developed and exercised locally before they are promoted to the AI Skills Library.

## What Changes

- Add a `triage-analyze` skill that performs read-only whole-repository or focused analysis, writes an ignored Markdown report packet, reports Standardization and Architecture health meters, and offers optional next steps.
- Add a `triage-standardize` skill that reads its complete, editable shipped standards document, analyzes project, class, and AI-readiness conformance, and applies only explicitly approved low-risk conformity changes.
- Add a `triage-rearchitect` skill that revalidates one selected architecture candidate, plans a staged behavior-preserving refactor, and applies it only after explicit user approval.
- Ship editable, language-agnostic starter templates for project structure, class/object-oriented units, AI readiness, and `.aiignore` guidance; use React and TypeScript only as illustrative examples.
- Preserve a hybrid artifact model: ignored timestamped diagnostic reports in `output/reports/`, editable shipped standards and deferred decisions in the Standardize skill, and optional user-invoked OpenSpec promotion for selected findings.
- Honor `.aiignore` before exploration and offer, but never automatically create, a reviewed `.aiignore` draft when one is absent.
- Detect material uncertainty, optionally offer the locally available `openspec-grill-me` interview, and resume the originating triage workflow after the user accepts and resolves the question.

## Capabilities

### New Capabilities

- `triage-analysis`: Inspect a repository without modifying production code and create reusable, evidence-backed triage reports with scores, trends, and optional handoffs.
- `triage-standardization`: Establish and enforce a project-owned standardization baseline covering project structure, class contracts, and AI readiness.
- `triage-rearchitecture`: Select, revalidate, plan, and explicitly apply bounded architecture refactors based on triage evidence.

### Modified Capabilities

- None.

## Impact

- Adds three project-local Agent Skills under a new `.agents/skills/triage/` family, plus their bundled Markdown templates.
- Adds one complete editable standards document with the Standardize skill; it is usable without a setup-generated project copy.
- Writes ignored diagnostic reports beneath `output/reports/triage-analyze/` in accordance with repository output rules.
- Reads existing repository instructions, documentation, Git history, validation configuration, and `.aiignore` when present; does not require OpenSpec, but can hand selected findings into a user-invoked OpenSpec proposal.
