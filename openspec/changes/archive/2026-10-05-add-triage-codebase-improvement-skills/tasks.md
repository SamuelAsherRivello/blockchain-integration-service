# Tasks

## 1. Scaffold the triage skill family

- [x] 1.1 Create the discoverable `.agents/skills/triage/` package layout for `triage-analyze`, `triage-standardize`, and `triage-rearchitect`, each with valid Agent Skills frontmatter; verify the local skill discovery mechanism lists all three skills.
- [x] 1.2 Add concise shared guidance describing skill boundaries, user-invocation expectations, optional OpenSpec integration, local Grill Me availability checks, and `.aiignore` precedence; verify each skill can be read independently without requiring OpenSpec.

## 2. Implement report-oriented triage analysis

- [x] 2.1 Author `triage-analyze` instructions for scoped and whole-repository read-only assessment, `.aiignore` handling, evidence collection, prior-report comparison, and stale-evidence revalidation; verify a dry run does not modify production source files.
- [x] 2.2 Add Markdown report templates for the overview, Standardization details, Architecture details, and verification baseline, including two primary health meters, equal default weighting, confidence, trend classifications, and optional handoff sections; verify all internal report links resolve inside one generated run packet.
- [x] 2.3 Exercise `triage-analyze` against this repository and verify it writes its timestamped packet only under `output/reports/triage-analyze/`, reports the two required categories, and does not classify absent baseline inputs as zero scores.

## 3. Implement template-driven standardization

- [x] 3.1 Add language-agnostic Project, Class, AI-Readiness, and `.aiignore` starter Markdown templates with React and TypeScript examples clearly labeled as examples; verify the templates distinguish object-oriented contract expectations from language-specific syntax.
- [x] 3.2 Author `triage-standardize` instructions for a complete active shipped standards document, optional in-place advanced-user edits, known exceptions, deferred decisions, and configurable score weights; verify the first-run path stops before production-code changes.
- [x] 3.3 Author Standardize's focused-analysis and application gate, including exact-delta display, explicit user apply approval, safe low-risk conformance changes, architecture escalation, AI-readiness assessment, and optional `.aiignore` draft; verify an unapproved delta changes no repository source, structure, documentation, or configuration.
- [x] 3.4 Run the approved first-use Standardize workflow against this repository, review the generated standards draft with the user, and verify any subsequently approved low-risk change with the repository's applicable checks.

## 4. Implement selected-candidate rearchitecture

- [x] 4.1 Add a refactor-plan template covering candidate evidence, current and target responsibilities, contracts, state ownership, dependency direction, migration steps, verification, rollback considerations, and OpenSpec handoff data; verify the template excludes cosmetic standardization work.
- [x] 4.2 Author `triage-rearchitect` instructions that require one user-selected candidate, revalidate stale findings, distinguish structural work from Standardize work, and offer Grill Me when material uncertainty blocks a safe plan; verify no implementation begins before selection and explicit apply approval.
- [x] 4.3 Exercise Rearchitect against one candidate from the live Analyze report through candidate selection and plan generation only; verify no source changes occur unless the user explicitly approves the selected plan.

## 5. Validate the three-skill workflow

- [x] 5.1 Validate each `SKILL.md` frontmatter and referenced template path, and verify the three skills remain language-agnostic while using the repository's TypeScript and React material only as examples.
- [x] 5.2 Review generated reports and standards artifacts for compliance with `AGENTS.md`: ignored diagnostics stay under `output/`, no secrets are written, tracked decisions stay in their designated documentation, and unrelated existing working-tree changes remain untouched.
- [x] 5.3 Run `openspec validate add-triage-codebase-improvement-skills --strict` and resolve all planning-artifact validation errors; record the local validation results in the change review.
