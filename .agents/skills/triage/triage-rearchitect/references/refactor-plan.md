# Architecture refactor plan

Create one plan per selected candidate. Replace this guidance with repository-specific evidence before presenting it for approval.

```markdown
# Refactor Plan: [candidate]

Refactor plan · Back

**Run:** [run id]  
**Scope:** [modules and paths]  
**Evidence:** [links to focused triage findings]  
**Decision required:** [the approval requested]

## Problem and non-goals

State the observable structural problem, its impact, and work deliberately excluded from this refactor.

## Current model

Use a compact ASCII diagram where useful. Identify modules, public contracts, dependency direction, state/data ownership, and communication paths.

## Desired model

Show the intended boundaries and explain how they reduce the problem without adding unnecessary abstraction.

## Contract and migration strategy

List public interfaces, callers, compatibility seams, construction/injection changes, data migration, error behavior, and any deprecation path.

## Staged implementation

1. [Small behavior-preserving stage and verification.]
2. [Next stage and verification.]
3. [Removal or cleanup only after callers migrate.]

## Deliberation record

### Orchestrator thoughts

State the orchestrator's evidence-based decision after consulting all three advisors. Explain the selected path, rejected alternatives, material disagreement, unresolved questions, and why the decision is proportionate to the candidate. This is the orchestrator's reasoning, not a vote tally.

### Per-role summary

Record every advisor, including a role whose proposed actions were not selected. List concrete championed actions and their disposition: adopted, adapted, deferred, or rejected.

| # | Role | Central thoughts | Champion actions | Disposition and rationale |
| --- | --- | --- | --- | --- |
| ROLE01 | Contrarian | [Evidence-backed restraint, risks, or no-change case] | [Specific action or none] | [Disposition and reason] |
| ROLE02 | Dreamer | [Ambitious alternative and validated opportunity] | [Specific action or none] | [Disposition and reason] |
| ROLE03 | Pragmatic | [Smallest viable, reversible path] | [Specific action or none] | [Disposition and reason] |

## Verification matrix

Identify the baseline characterization/contract checks before moving code. Every stage must name a focused check; completion requires the broader checks appropriate to the affected boundary. A passing typecheck or build is not behavioral proof.

| # | Check or scenario | Proves | Baseline result | Stage or completion result | Limitation |
| --- | --- | --- | --- | --- | --- |
| VERI01 | [focused contract, unit, integration, or manual scenario] | [observable behavior or boundary] | [run / not run and result] | [planned or actual result] | [environment, external dependency, or coverage limit] |

## Risk, rollout, and rollback

State blast radius, failure modes, feature flags or migration safeguards when applicable, and how a safe rollback would work.

## Verification

List focused tests, integration checks, static checks, and manual scenarios. Distinguish planned checks from checks actually run.

## Open questions and approval

State every unresolved decision and the exact approval needed before implementation.
```
