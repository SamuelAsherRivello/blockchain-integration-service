---
name: triage-standardize
description: Align a codebase with its approved project, class, and AI-readiness standards through bounded, low-risk changes. Use after triage analysis or when the user wants to establish and apply a standards baseline without rearchitecting.
---

# Triage Standardize

## Outcome

Apply the complete, editable standards baseline shipped at [references/standards-document.md](references/standards-document.md). Standardization compares the repository to that baseline, shows the precise delta, and only applies explicit, low-risk conformity changes after user approval. It is language-agnostic and treats interfaces/contracts as the OOP mechanism for making expectations explicit.

## Optional focus

All arguments are optional. A user may append a short plain-language description of areas to include or exclude, for example: `focus on integration package class files; exclude Slidev documentation`. Apply that constraint to the analysis, proposed baseline, delta, and potential changes. Default to the whole repository when no focus is supplied. Explicit exclusions take precedence over the default scope and never override repository instructions or `.aiignore`. State the chosen focus and resulting blind spots; ask one concise question only if its wording would materially change the proposed standard or edit set.

## Exclusion files

Before broad inspection, read `.aiignore` and `.triageignore` when present. `.aiignore` is a repository-wide AI access boundary: honor it strictly and do not read, quote, infer from, or modify a matched path. `.triageignore` is triage-only scope configuration: honor its nonblank, non-comment repository-relative patterns for analysis, standards comparison, delta planning, changes, verification, and retention decisions by any triage skill. A missing `.triageignore` is equivalent to a blank file. Neither file can override repository instructions. State material `.triageignore` blind spots in each affected plan or result. Do not create or change either file unless the user explicitly requests it.

## Table identifiers

For every Markdown table created in a Standardize report or plan, make `#` its first column. Give each data row a unique identifier within that document: an uppercase short section word plus a two-digit sequence, such as `META01`, `READY01`, `SAFE01`, or `DEC01`. Preserve existing identifiers when updating a report or plan; assign the next unused identifier rather than renumbering rows.

## Breadcrumbs

When Standardize writes more than one Markdown document in one run directory, designate the initial plan or overview document as the packet root. Every document must begin with the complete packet breadcrumb in the same order: the root page, every packet page, then `Back`. Render the current page as plain text and every other packet page as a relative Markdown link. On the root page, render both its own name and `Back` as plain text; on a subpage, link the root page and `Back` to the root page. For example: `Standardization plan · [Standardization result](standardization-result.md) · Back` on the root plan, then `[Standardization plan](standardization-plan.md) · Standardization result · [Back](standardization-plan.md)` on the result. A single-document run uses its document title followed by plain `Back`.

## Boundaries and preparation

1. Read repository instructions, `.aiignore`, and `.triageignore` before source inspection. Honor `.aiignore` fully and `.triageignore` for triage scope; do not inspect, quote, infer from, or modify an excluded path.
2. Locate a current `triage-analyze` packet. If it is missing, stale, or not focused on Standardization, invoke `$triage-analyze` in focused `standardization` mode before proposing work. Revalidate relevant findings against the current commit and standards baseline.
3. Do not change module ownership, dependency direction, public contracts, state ownership, or inter-module communication. Escalate those observations to `$triage-rearchitect`.
4. Do not create or change `.aiignore` or `.triageignore` merely because either is absent. When a focused Analyze packet recommends a project-specific `.aiignore`, show the proposed patterns, the concrete risk each addresses, and why repository instructions or `.gitignore` do not already provide that boundary; wait for explicit approval before drafting or changing it.

## Active shipped baseline

1. Read [the complete standards document](references/standards-document.md) first. It already includes the Project Template, Class Template, AI-readiness expectations, score weights, verification guidance, and exception/deferred-decision sections.
2. Treat this shipped document as the active baseline immediately. A beginner need not create, copy, or approve a setup file before receiving a useful standardization delta.
3. A user may edit the shipped document directly to add repository-specific decisions. Its `Baseline status` section identifies whether it remains the default or has been customized. Do not create or require `docs/triage/standards.md`.
4. Discover existing repository conventions and constraints. Preserve intentional conventions; do not impose a generic framework layout merely because it differs from a default illustration.

## Apply an approved baseline

1. Read [the shipped standards document](references/standards-document.md) and the focused analysis. Classify each delta as `safe standardization`, `needs decision`, `architecture change`, or `out of scope`.
2. Establish a proportionate verification baseline before planning changes. Identify the relevant link, documentation, static, build, unit, integration, and manual checks from repository evidence; distinguish checks actually run from checks merely discovered.
3. Present an exact change plan: affected paths, before/after intent, expected behavior preservation, verification commands or manual scenarios, test limitations, and exclusions. Every approved row must name the smallest check that can detect its intended regression; documentation-only changes should include a local-link or rendering check when available.
4. Apply only user-approved `safe standardization` items. Keep edits narrow and preserve behavior. Examples include approved naming, folder placement, documentation, class member ordering, explicit contract placement, consistent configuration, and AI-facing repository guidance.
5. Verify the changed scope with the planned focused checks, then run broader checks only when the change's risk or repository instructions justify them. Inspect the diff for unintended behavior, generated artifacts, or link changes. Report commands not run and why; never describe a static/build check as behavioral proof.
6. Update the relevant triage packet or write a new focused packet under `output/reports/triage-standardize/<run-id>/`; record each applied row's verification evidence without rewriting historical analysis as if it were current.

## Assess AI readiness

Evaluate the repository against its approved AI-readiness section. Report each item as `nailed`, `partial`, `missing`, or `N/A`:

- canonical agent instructions and their scope;
- reliable command discovery and expected verification;
- project orientation and module map;
- definition of done and quality boundaries;
- maintenance relationships between documentation, tests, and implementation;
- safety boundaries such as ignore rules, secrets handling, generated output, and protected paths.

Prefer concise pointers to canonical material over copied, conflicting guidance. Do not represent AI-ready documentation as a substitute for human review or testing.

## Finish responsibly

State what was analyzed, what changed, what was deferred, and the verification evidence. If the recommendation depends on unresolved intent, check whether `$openspec-grill-me` is locally available and offer an optional interview; do not start it automatically. If the work is broad, risky, or crosses a product decision, offer an optional `$openspec-propose` handoff with evidence and non-goals. Neither OpenSpec nor Grill Me is required for this skill.
