---
name: triage-analyze
description: Assess a codebase's standardization and architecture health without changing production code. Use when the user wants a reusable Markdown triage report, codebase health score, refactor candidates, or a baseline before standardizing or rearchitecting.
---

# Triage Analyze

## Outcome

Produce an evidence-backed, read-only triage packet for the repository or an explicitly named scope. The packet gives the user an overall health score, two primary categories - **Standardization** and **Architecture** - a repository-integrity scan, and clear optional next steps for `$triage-standardize`, `$triage-rearchitect`, and OpenSpec.

The default mode is a whole-repository assessment. Accept a focused `standardization` or `architecture` mode when another triage skill needs only that analysis. React and TypeScript may appear in examples, but do not make recommendations dependent on one language or framework. Assess OOP systems in terms of explicit contracts/interfaces, responsibility, state ownership, dependency direction, composition, and test seams.

## Optional focus

All arguments are optional. A user may append a short plain-language description of areas to include or exclude, for example: `focus on BIS/packages/integration and exclude Slidev documentation`. Treat it as a scope constraint, not as permission to bypass repository instructions or `.aiignore`. Default to the whole repository when no focus is supplied. Explicit exclusions take precedence over the default scope; acknowledge the chosen focus and any material blind spots in the packet. Ask one concise question only when the wording leaves a decision that would materially change the analysis.

## Exclusion files

Before broad inspection, read `.aiignore` and `.triageignore` when present. `.aiignore` is a repository-wide AI access boundary: honor it strictly and do not read, quote, infer from, or modify a matched path. `.triageignore` is triage-only scope configuration: honor its nonblank, non-comment repository-relative patterns for discovery, analysis, integrity findings, scoring evidence, recommendations, and changes by any triage skill. A missing `.triageignore` is equivalent to a blank file. Neither file can override repository instructions. State material `.triageignore` blind spots in each affected packet. Do not create or change either file unless the user explicitly requests it.

## Table identifiers

For every Markdown table created in a report packet, make `#` its first column. Give each data row a unique identifier across the whole packet: an uppercase short section word plus a two-digit sequence, such as `META01`, `STND01`, `ARCH01`, `INTG01`, or `READY01`. Preserve existing identifiers when updating a packet; assign the next unused identifier rather than renumbering rows.

## Safety and scope

1. Read repository instructions (including `AGENTS.md`) and identify the project root before inspecting source.
2. Locate and read `.aiignore` and `.triageignore` before any broad source scan. Honor `.aiignore` as an access rule and `.triageignore` as a triage-only scope exclusion. You may report safe aggregate metadata when it is genuinely available without reading an `.aiignore`-matched path.
3. Write reports only under `output/reports/triage-analyze/<run-id>/`. If `.aiignore` or repository instructions make that destination unavailable, stop and ask the user for an allowed destination.
4. Do not edit production code, configuration, tests, `.aiignore`, or the shipped standards document. This skill may create only its Markdown packet and routine diagnostic output under `output/`.
5. Never treat a prior finding as resolved merely because it is absent from a later report.

## Analyze

1. Establish the baseline: inspect repository structure, source boundaries, build/test/lint command discovery, documentation, contribution guidance, and recent relevant history when available. Record commands as discovered; do not claim they passed unless you ran them and captured the result.
2. Read the shipped Standardize [standards document](../triage-standardize/references/standards-document.md) as the active baseline. If its `Baseline status` remains `Shipped default`, identify existing conventions and label the report: **`standards-document.md` has not been customized by user. Using defaults.** Link that filename to the shipped source. If the status records a customization, treat the edited document as the active baseline rather than looking for a second copy elsewhere.
3. Find prior packets under `output/reports/triage-analyze/` only when they are accessible and relevant. Revalidate their findings against the current source, current commit, and current standards document. Classify each prior item as `resolved with evidence`, `still present`, `worsened`, `not re-observed`, or `deferred`; include the supporting evidence.
4. In **standardization** analysis, compare project structure, naming, class/interface organization, configuration, documentation, and AI-readiness material with the approved baseline where one exists. Assess AI readiness as `nailed`, `partial`, `missing`, or `N/A` for canonical agent instructions, command discovery, orientation, definition of done, maintenance relationships, and safety boundaries. When `.aiignore` is absent, recommend a project-specific `.aiignore` as an optional `$triage-standardize` follow-up only when evidence shows that it would protect AI-assisted work beyond existing repository instructions and `.gitignore`; absence alone is not a defect, does not lower the score by itself, and does not justify drafting or creating the file.
5. Establish a **verification baseline**. Discover unit, integration, end-to-end, static, build, and manual checks from manifests, CI, scripts, and durable documentation. For each relevant check, record its source, intended scope, command or procedure, whether it was run, its actual result when run, and environmental limitations. Discovery is not proof that a check passes.
6. Assess whether the affected boundaries have meaningful test seams: public contracts, injected collaborators, error paths, state transitions, and high-risk integrations. Report missing or weak coverage as evidence-backed risk, not as an invented test requirement. Do not count a passing build or typecheck as behavioral coverage.
7. Perform a read-only **repository-integrity scan** as part of Standardization. Identify candidates for stale documentation, orphaned code, unused exports, scripts, configuration, and assets by cross-checking references, manifests, build/runtime entry points, tests, and documentation links. Record the signals and limits; static non-reference is not proof that an item is removable because framework discovery, reflection, generated references, external consumers, fixtures, and planned work can be legitimate.
8. Treat documentation as stale only when a current-state claim is contradicted by evidence or its named target is absent. Do not flag clearly labeled `Planned`, `Proposed`, `Roadmap`, `Future`, historical, or equivalent forward-looking material merely because it is not implemented. If a document's status is unclear, record it as a decision or question rather than a defect.
9. Classify integrity results as `confirmed stale`, `orphan candidate`, `intentionally future-facing`, `not assessed`, or `not applicable`. Analyze never deletes, moves, or suppresses a candidate. Route approved documentation and low-risk cleanup to `$triage-standardize`; route a candidate involving obsolete ownership, module boundaries, or dependency direction to `$triage-rearchitect`.
10. Recommend a small, prioritized set of candidates. Each candidate needs evidence, expected value, risks, non-goals, verification needs, and the appropriate owner skill. Keep analysis actionable rather than encyclopedic.

## Score consistently

Score each eligible category from 0 to 100. Use the score weights in the shipped standards document; its default is an equal 50/50 blend of Standardization and Architecture. Present each score with a native HTML meter, for example `<meter value="60" min="0" max="100" low="20" high="60" optimum="90"></meter> 60/100`.

Use these bands for each category:

- `80-100`: healthy; improvements are deliberate optimization.
- `60-79`: workable; address important drift during normal maintenance.
- `40-59`: material friction; plan focused improvement soon.
- `0-39`: high risk; prioritize corrective work before broad feature expansion.

Score refactor urgency separately from repository health. Urgency combines impact, likelihood of continued change, coupling/blast radius, delivery friction, and confidence in evidence. State the factors; a low health score does not automatically mean an urgent refactor. A template-pending baseline may be scored from observed conventions, but must be disclosed as provisional; if an input cannot be scored honestly, show it as `Not scored` rather than silently reweighting it.

## Write the packet

Read [the report-packet reference](references/report-packet.md) before writing. Create this packet:

```text
output/reports/triage-analyze/<run-id>/
|-- overview.md
|-- standardization-analysis.md
|-- architecture-analysis.md
`-- verification-baseline.md
```

Use a stable, sortable `<run-id>` such as `2026-10-05T143000Z`. Link the documents with relative Markdown links. Every page in a multi-page packet must begin with the complete packet breadcrumb in the same order: `Overview`, then every packet page, then `Back`. Render the current page as plain text and every other packet page as a relative Markdown link. On `overview.md`, render both `Overview` and `Back` as plain text; on every subpage, link `Overview` and `Back` to `overview.md`. For example, the overview begins `Overview · [Standardization analysis](standardization-analysis.md) · [Architecture analysis](architecture-analysis.md) · [Verification baseline](verification-baseline.md) · Back`; the architecture page begins `[Overview](overview.md) · [Standardization analysis](standardization-analysis.md) · Architecture analysis · [Verification baseline](verification-baseline.md) · [Back](overview.md)`. `overview.md` must include the two major categories exactly named **Standardization** and **Architecture**, an overall meter, score provenance, refactor urgency, evidence limits, and optional follow-up commands.

Include a concise OpenSpec handoff section: suggested change scope, evidence, non-goals, and unresolved questions. Do not create an OpenSpec change automatically. Say that the user may invoke `$openspec-propose` using the packet.

## Finish responsibly

Summarize the report in conversation and name its location. Recommend `$triage-standardize` only for conformity and AI-readiness work; recommend `$triage-rearchitect` only for module, contract, dependency, ownership, or communication changes.

If material unresolved doubt would change the recommendation, check whether `$openspec-grill-me` is locally available. If so, offer this optional next step: "The analysis is complete, but I have material doubts about <topic>. Would you like me to grill you to resolve them?" Do not start an interview or another skill unless the user accepts.
