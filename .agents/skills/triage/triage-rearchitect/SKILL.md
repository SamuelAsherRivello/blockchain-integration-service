---
name: triage-rearchitect
description: Plan and apply one selected, evidence-backed architecture refactor involving modules, contracts, ownership, dependencies, or communication. Use after triage analysis or when the user wants a bounded structural improvement rather than formatting or project-standard changes.
---

# Triage Rearchitect

## Outcome

Select one structural candidate, build a behavior-preserving refactor plan, and apply it only after explicit approval. Rearchitecture concerns how modules, objects, and contracts interrelate - not cosmetic structure or class formatting.

## Optional focus

All arguments are optional. A user may append a short plain-language description of areas to include or exclude, for example: `focus on marketplace-to-integration contracts; exclude the onboarding spike`. Use it to limit candidate discovery, revalidation, and the selected refactor plan. Default to the whole repository when no focus is supplied. Explicit exclusions take precedence over the default scope and never override repository instructions or `.aiignore`. State the chosen focus and blind spots; ask one concise question only when the requested focus is too ambiguous to select or safely plan a candidate.

## Exclusion files

Before broad inspection, read `.aiignore` and `.triageignore` when present. `.aiignore` is a repository-wide AI access boundary: honor it strictly and do not read, quote, infer from, or modify a matched path. `.triageignore` is triage-only scope configuration: honor its nonblank, non-comment repository-relative patterns for candidate discovery, revalidation, refactor plans, changes, verification, and retention conclusions by any triage skill. A missing `.triageignore` is equivalent to a blank file. Neither file can override repository instructions. State material `.triageignore` blind spots in each affected plan or result. Do not create or change either file unless the user explicitly requests it.

## Table identifiers

For every Markdown table created in a refactor plan or follow-up report, make `#` its first column. Give each data row a unique identifier within that document: an uppercase short section word plus a two-digit sequence, such as `CAND01`, `STEP01`, `RISK01`, or `VERI01`. Preserve existing identifiers when updating a plan; assign the next unused identifier rather than renumbering rows.

## Breadcrumbs

When Rearchitect writes more than one Markdown document in one run directory, designate the refactor plan as the packet root. Every document must begin with the complete packet breadcrumb in the same order: `Refactor plan`, every follow-up page, then `Back`. Render the current page as plain text and every other packet page as a relative Markdown link. On the refactor-plan root, render both `Refactor plan` and `Back` as plain text; on a subpage, link both labels to `refactor-plan.md`. A single-plan run begins with `Refactor plan · Back`.

## Establish the evidence

1. Read repository instructions, `.aiignore`, and `.triageignore` before broad source inspection. Treat `.aiignore`-matched paths as unavailable and `.triageignore`-matched paths as out of triage scope: do not read, quote, infer from, or modify them.
2. Locate a current architecture section from a `triage-analyze` packet. If none is current for the selected scope, invoke `$triage-analyze` in focused `architecture` mode and use its packet as evidence.
3. Revalidate the selected finding against the current commit, source, public contracts, tests, and standards baseline. Mark any unsupported assumption as a question.
4. Distinguish architecture from standardization. Naming, file ordering, documentation, and project-tree conformity belong to `$triage-standardize`; ownership, module boundaries, contracts, dependency direction, state, and communication belong here.

## Select one candidate

Present a short ranked list only when the user has not selected a candidate. Each item needs evidence, expected value, risk, blast radius, refactor urgency, non-goals, and confidence. Ask the user to choose one. Do not bundle independent candidates into one broad refactor.

## Deliberate with three advisors

After one candidate is selected and revalidated, the skill runner becomes the **orchestrator**. It retains responsibility for the decision, plan, and approval gate; the three subagents are independent analysis-only advisors, not voters or implementers.

Before creating them, announce without asking permission that three analysis-only subagents will be deployed: **Contrarian** (scope and risk restraint), **Dreamer** (ambitious architecture alternatives), and **Pragmatic** (the smallest reversible improvement). Then create all three with the same evidence packet: selected candidate, focus and exclusions, revalidation findings, relevant contracts and tests, known constraints, and open questions. Tell each subagent to avoid modifying files, invoking follow-on workflows, or broadening the candidate. Require every claim to distinguish direct evidence from inference and to name uncertainty.

```text
[Evidence and selected candidate]
                |
                v
       [Orchestrator creates all 3]
          /           |           \
         v            v            v
 [Contrarian]     [Dreamer]    [Pragmatic]
         \            |            /
          v           v           v
       [Orchestrator thoughts and decision]
                |
                v
     [Plan, approval gate, or a documented stop]
```

### Contrarian

The contrarian is the steward of restraint. It assumes that a proposed refactor may be unnecessary until the evidence proves that the current structure causes material delivery, correctness, operability, or maintenance harm. It looks for the smallest safe scope, the option to defer, and the case for changing nothing.

Ask it to challenge speculative abstractions, new dependencies, public-contract churn, hidden migrations, compatibility breaks, operational burden, fragile tests, irreversible data or state changes, and optimistic cost estimates. It should expose the failure modes that a happy-path design omits, identify what must remain stable, and state the evidence threshold required to justify every new moving part. Its recommendations should favor deletion, preservation, compatibility seams, and explicit rollback triggers where those reduce risk.

### Dreamer

The dreamer is a research-minded architecture scout. It searches beyond current local habits for ideas that could make the selected boundary clearer, more composable, more observable, or more adaptable to likely future work. It may draw on emerging or academic practices such as capability-oriented design, functional cores with imperative shells, explicit effect boundaries, domain modeling, event-oriented communication, richer type contracts, or architecture fitness functions when they genuinely illuminate the candidate.

Ask it to propose a small number of ambitious alternatives, articulate the desirable end state, and reveal opportunities that an incremental review could miss. It must label each idea's maturity, adoption cost, migration path, and concrete benefit to this repository. Novelty alone is never a recommendation: the dreamer must identify the smallest experiment or seam that would validate an idea before it becomes a commitment.

### Pragmatic

The pragmatic advisor is an incremental delivery engineer. It seeks the smallest practical change that removes the demonstrated friction while fitting the repository's existing conventions, tests, tooling, team knowledge, and release constraints. It translates larger aspirations into a sequence of reversible, independently verifiable steps.

Ask it to identify the narrowest stable boundary, callers that can migrate gradually, existing helpers that can be reused, and checks that prove behavior at each stage. It should prefer clear ownership, simple composition, low-cost compatibility, and an implementation that is easy to explain and maintain. It must still call out when a seemingly small patch merely hides a structural problem or creates debt that will immediately compound.

### Orchestration rules

Wait for all three analyses before creating a refactor plan or recommending an action. If a subagent fails, retry that consultation once; if it still cannot report, pause before planning and state that the required perspective is unavailable. Do not invent or silently substitute a role's analysis.

Then write a distinct **Orchestrator thoughts** section. Reconcile the advisors against the evidence rather than counting votes. State the orchestrator's own reasoning, decision, rejected alternatives, unresolved questions, and why the selected path is proportionate to the candidate. The orchestrator may adopt, adapt, defer, or reject any advice, but it must preserve material disagreement and uncertainty.

For each role, record its central thoughts, the concrete actions it championed, and the disposition of each action: adopted, adapted, deferred, or rejected, with a brief rationale. Include every role even when none of its actions are selected.

## Plan before changing code

Read [the refactor-plan reference](references/refactor-plan.md) and create a plan at:

```text
output/reports/triage-rearchitect/<run-id>/refactor-plan.md
```

The plan must describe the current and desired module model, contract changes, state/data ownership, dependency-direction changes, migration steps, compatibility strategy, failure behavior, tests, rollout/rollback considerations, and excluded work. Include the **Orchestrator thoughts** and the per-role deliberation summary described above. Before implementation, identify existing characterization, contract, integration, and manual tests that protect the affected behavior. For each implementation stage, name the smallest check that proves the intended behavior and the larger check required before completion. Use ASCII diagrams when a relationship is materially easier to understand visually.

Show the plan and request explicit approval before changing code. A plan is not consent to implement it. If the scope is large, crosses product decisions, or deserves reviewable durable planning, offer an optional `$openspec-propose` handoff. Do not create an OpenSpec change automatically.

## Apply an approved refactor

1. Run the planned baseline checks before changing code when practical. If a required characterization or contract check is missing, add it before or alongside the smallest behavior-preserving stage; explain any exception.
2. Make the smallest staged changes that realize the selected plan. Preserve observable behavior unless the approved plan names a behavior change.
3. Introduce or strengthen interfaces/contracts at meaningful boundaries. Prefer composition and explicit dependency direction; avoid artificial abstractions and inheritance.
4. Keep adapters, domain/application logic, and infrastructure concerns appropriately separated for the project. Maintain compatibility seams or migration steps when callers need them.
5. Run the planned focused check after each stage and the defined broader checks before completion. Inspect the diff, distinguish static/build evidence from behavioral evidence, and report both results and limitations. Update the refactor plan with completed steps and deviations rather than silently revising history.

## Finish responsibly

State the selected candidate, changes, verification, remaining risks, and follow-up work. End with the orchestrator's own conclusion and a per-role summary that names each role's thoughts plus any concrete adopted or adapted action it championed. If material uncertainty would change the plan, check whether `$openspec-grill-me` is locally available and offer an optional interview; do not begin it automatically. Return to this workflow after the user resolves the uncertainty.
