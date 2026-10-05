# Design

## Context

See [proposal.md](proposal.md) for motivation. This repository has project-local Agent Skills under `.agents/skills/`, ignores `/output`, documents its current project-structure ideas in `BIS/documentation/best-ideas.md`, and uses OpenSpec as an optional planning system. The new skills must be language-agnostic while using object-oriented contracts as their default analysis vocabulary.

## Goals / Non-Goals

**Goals:**

- Make the three skills independently useful and composable, with Analyze as their shared evidence engine.
- Keep diagnoses reusable without making generated reports permanent repository noise.
- Give beginners a guided standards setup while allowing advanced users to directly edit the durable baseline.
- Keep source-changing work explicit, bounded, and verifiable.

**Non-Goals:**

- Prescribe a single framework, language, architecture style, directory tree, or class syntax.
- Replace dedicated security, bug-diagnosis, dependency, performance, or product-design reviews.
- Require OpenSpec, an issue tracker, remote services, or a GitHub connection.
- Treat `.aiignore` as a guaranteed sandbox or security enforcement mechanism.

## Decisions

### Three composable skill packages

Place `triage-analyze`, `triage-standardize`, and `triage-rearchitect` beneath `.agents/skills/triage/`. Each package owns a concise `SKILL.md` and only the reference templates it needs. The first is read-only to production code; the other two are separate user-invoked change workflows with explicit gates.

This matches the desired manual sequence while permitting direct invocation: Standardize requests focused standardization analysis and Rearchitect requests focused architecture analysis when a full report is absent or stale.

### Hybrid artifact lifetime

Analyze writes a new timestamped Markdown packet to `output/reports/triage-analyze/<run-id>/`. The overview is the human and machine handoff and links to focused detail files. It records commit identity, selected scope, standards fingerprint, prior reports considered, confidence, and report freshness.

The complete editable standards document lives with `triage-standardize`, not in generated reports or a missing project path. It contains Project, Class, and AI-Readiness templates; default and optional score weights; known exceptions; and intentionally deferred decisions. A user may edit it in place, and a later OpenSpec proposal or ADR can supersede a decision when the user elects durable planning.

This avoids committing every diagnostic snapshot while retaining the information a fresh clone needs. The report destination follows project-specific output guidance; if unavailable, the skills ask rather than invent a tracked location.

### Two-category scoring model

Analyze reports Standardization Health and Architecture Health as the primary meters. Overall Repository Health uses a 50/50 default blend and reads optional user overrides from the standards document. Each meter exposes its evidence and unavailable inputs; no score is fabricated for a missing baseline. Architecture also carries a separate refactor-urgency signal because health and urgency point in opposite directions.

### Standards initialization and conformance boundaries

The shipped standards document provides a complete beginner-facing default and is active on the first run. Standardize surveys existing practice, lists the exact low-risk delta, and requests explicit apply confirmation before changing repository files. Advanced users may edit the shipped document in place to record project-specific decisions.

Standardize owns structure, names, class/object contract conventions, and AI readiness. It does not change responsibility ownership, module interfaces, or dependency direction. Such findings are handed to Rearchitect.

### AI readiness and ignore handling

AI readiness is a Standardization subcategory. It assesses canonical agent context, command discoverability, documentation and maintenance knowledge, verification expectations, and safe operating constraints. The shipped template makes `.aiignore` review discoverable, but the skill drafts rather than automatically creates a missing ignore policy.

All triage skills look for `.aiignore` before broad scanning. They do not read, analyze, quote, mutate, or infer ignored contents. If an ignored path includes their output destination, they stop and request an allowed destination.

### Rearchitecture safety boundary

Rearchitect requires one user-selected candidate. It refreshes stale evidence, produces a staged refactor plan with contracts, ownership, migration order, verification, and rollback considerations, then waits for an explicit apply approval. It treats cosmetic template drift as a Standardize concern.

### Optional OpenSpec and Grill Me bridges

The triage skills never require or automatically create an OpenSpec change. A report or selected candidate includes an optional OpenSpec handoff section containing scope, evidence, non-goals, and unresolved decisions for a user-invoked proposal.

When a material doubt blocks a safe conclusion, a skill checks whether `openspec-grill-me` is locally available and offers a focused interview. On acceptance, the interview returns to the originating workflow, which owns the updated report or plan. If unavailable or declined, the question remains explicitly unresolved.

## Risks / Trade-offs

- [Reports are ignored and can disappear between clones] → Keep approved standards and decisions tracked; require current-evidence revalidation before reuse.
- [Generic templates impose unwanted conventions] → Draft from local evidence and require user approval before standards become authoritative.
- [Repository-wide Standardize creates an unexpectedly large diff] → Display the exact delta and require explicit apply approval.
- [Architecture scoring suggests false precision] → Show source evidence, confidence, and missing inputs alongside every meter.
- [`.aiignore` is not uniformly enforced by agent hosts] → Treat it as an explicit triage-skill policy and never claim it supplies sandbox security.
- [OpenSpec is unavailable in some repositories] → Keep report and implementation workflows fully functional without it.

## Migration Plan

1. Add the three local skill packages and bundled templates without modifying application packages.
2. Validate skill discovery and scenario coverage against this repository.
3. Run Analyze against the live repository to create a report packet.
4. Exercise Standardize's first-run draft flow; apply only separately approved low-risk changes.
5. Exercise Rearchitect only through candidate selection and planning unless the user later approves a specific refactor.
6. Promote validated skills to the AI Skills Library in a separate, explicitly authorized move.
