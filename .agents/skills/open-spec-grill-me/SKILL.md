---
name: open-spec-grill-me
description: Relentlessly interview the user about an OpenSpec plan, exploration, or existing proposal; resolve the design tree with recommended answers, investigate answerable codebase questions directly, and reconcile confirmed conclusions into planning artifacts. Use before, during, or after OpenSpec exploration or proposal creation. Never implements code.
---

# Open Spec Grill Me

Drive ambiguity out of an OpenSpec change through an adaptive,
decision-by-decision interview, then incorporate the confirmed conclusions into
the relevant planning artifacts. This is a planning workflow only; never edit
implementation code.

**Canonical identity:** Resolve a change by either its preferred human-readable
name or its `C###` ID, and display both. Treat `C###` and `C###-T###` as
stable identity; never identify a change or task solely by mutable name or
wording.

## Establish Context

1. Determine whether the user supplied a plan, named a change, is already
   exploring one, or has an existing proposal.
2. Run `openspec list --json` and resolve the relevant change from explicit
   input, conversation context, or the only active change. If several changes
   are plausible, ask which one to use.
3. When a change exists, run `openspec status --change "<name>" --json` and read
   every existing artifact from the reported
   `artifactPaths.<id>.existingOutputPaths`. Use the reported schema, paths,
   dependencies, `changeRoot`, and `actionContext`; do not assume standard
   artifact names or locations.
4. Read the resolved OpenSpec root's `config.yaml` or `config.yml` when present.
   Treat its context and artifact rules as constraints, not content to copy.
5. If the user selected a registered standalone store, discover its id and keep
   `--store <id>` on all OpenSpec commands that accept it.

## Grill the Design

Build and continuously revise a private decision tree covering the plan's
goals, users, scope, observable behavior, states and flows, data, interfaces,
integration points, failure modes, security and privacy, compatibility,
migration, operations, testing, acceptance criteria, rollout, and explicit
non-goals. Omit branches that genuinely do not apply; add domain-specific
branches revealed by the code or answers.

### Question Budget

- If the invocation argument consists of a single positive integer, interpret
  that integer as the maximum number of substantive grilling questions. For
  example, `$open-spec-grill-me 3` means "grill me with 3 questions." Do not
  treat the number as an option selection unless the surrounding conversation
  clearly contains a question awaiting that numbered answer.
- If the user gives an explicit limit such as "grill me with 5 questions," ask
  at most that many substantive grilling questions. Track the count across the
  invocation and label each one, for example `Question 2 of 5`.
- Repository investigations, evidence summaries, change-selection questions,
  and required write confirmations do not count as grilling questions. Do not
  evade the limit by packing unrelated decisions into one compound question.
- When the limit is reached, stop the interview even if material branches
  remain. Summarize the decisions reached and clearly list unresolved branches;
  do not ask an additional correction question. Reconcile only the conclusions
  actually established, subject to the normal artifact-write confirmations.
- If the user gives no question limit, keep asking one question per user turn
  until the Completion Test is satisfied.
- Investigate before asking. If repository files, existing specs, tests,
  history, configuration, or read-only commands can answer a question, inspect
  them and report the evidence instead of asking the user.
- Always order questions from most impactful and helpful to least. Resolve
  prerequisite decisions before dependent ones and revisit affected branches
  when an earlier assumption changes.
- Ask one focused question at a time unless a tiny group is inseparable. For
  every grilling question, provide numbered answer choices. Put the concrete
  recommended answer first and label it `(recommended)`, then end with an
  `Other (tell me more)` option.
- Challenge vague words such as "fast," "simple," "secure," "supported," and
  "done" until they become observable constraints or acceptance criteria.
- Probe contradictions and edge cases directly. Periodically summarize settled
  decisions, changed assumptions, and remaining branches.

Do not ask questions merely to be exhaustive. A question is material when
different answers would change scope, externally visible behavior, architecture,
compatibility, risk, implementation sequencing, or acceptance criteria.

## Completion Test

The grilling is complete only when Codex can explain, without inventing details:

- the problem, target users, desired outcome, and non-goals;
- the end-to-end behavior, important states, errors, and edge cases;
- the chosen design and why rejected alternatives lost;
- affected systems and compatibility or migration consequences;
- verifiable acceptance criteria and an implementation-ready task boundary;
- every remaining uncertainty, including why it is safe to defer.

Show this shared-understanding summary and ask the user to correct anything
inaccurate, unless an explicit question budget has already been exhausted. If
corrections expose new material branches and budget remains, resume the
interview.

## Reconcile Into OpenSpec

After the Completion Test is satisfied, or after an explicit question budget is
exhausted, map each established conclusion to the artifact whose schema
instructions own that information. Reconcile existing artifacts so scope,
requirements, design, and tasks do not contradict one another.

- Existing change: follow the `openspec-update-change` workflow. Propose exact
  revisions and reasons, obtain its required confirmations, and edit only paths
  already listed in `existingOutputPaths`.
- No change yet: identify the proposed change name and planning artifacts. If
  material ambiguity remains, report it instead of fabricating assumptions.
  Otherwise, obtain confirmation before following `openspec-propose`.
- Mid-exploration: continue using the current exploration context, but answers
  to interview questions are not permission to write.
- If an answer changes the proposal's intent rather than refining it, recommend
  a distinct new change instead of silently repurposing the existing one.
- Preserve unresolved items explicitly as assumptions, open questions, deferred
  tasks, or out-of-scope statements.
- Validate the resulting change and report what changed, what remains
  unresolved, and the next planning or apply step. Never start implementation
  in this invocation.

The requested outcome is a coherent, user-confirmed OpenSpec planning state,
not merely an interview transcript.
