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
   If the target is a named standalone planning document, read it and keep it
   as the artifact to refine; do not force it into a new OpenSpec change.
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
- Re-rank the remaining questions after every answer by expected return on
  investment: prioritize decisions that remove the most consequential
  uncertainty, unblock other decisions, or prevent substantial rework.
  Do not preserve the original question order when the answers change those
  priorities.
- Ask one focused question per turn. Present each grilling question in plain
  text with sequentially numbered choices, not just an open-ended question
  after a recommendation paragraph.
- Normally provide three concrete choices, followed by a fourth option:
  `Other (tell me more)`. Add more meaningful choices when useful, with Other
  always last; three is not a maximum. Keep alternatives distinct and relevant.
- Option 1 MUST be the concrete recommended answer, labeled `(recommended)`
  and accompanied by a short reason. Never assume that the user selected it.
- The final numbered option MUST be `Other (tell me more)`. Explicitly allow
  the user to type their own answer, with or without that option's number;
  Other is additional to the concrete choices, not a replacement for one.
- Do not use question widgets or user-input tools for this interview. As of
  the user's current ChatGPT version (2026-09-03), the question widget is not
  ready: it can close before the user answers. Present the multiple-choice
  question directly in chat, end the turn, and wait for the user's reply.
  When ChatGPT updates to a new version, compatibility may be rechecked.
  A version update alone does not establish that the widget works: keep
  widgets disabled until verification shows that questions remain available
  until the user answers and that replies are delivered reliably. Accept a
  number, an option's wording, or any free-form response. A widget closing or
  accepting delivery is not an answer.
- Never treat a recommendation or preselected widget option as an answer.
  Advance only after an explicit answer or request to skip. A skipped question
  remains unresolved. If delivery fails, re-present the same question with its
  choices and original number; do not consume another question from the budget.
- Challenge vague words such as "fast," "simple," "secure," "supported," and
  "done" until they become observable constraints or acceptance criteria.
- Probe contradictions and edge cases directly. Periodically summarize settled
  decisions, changed assumptions, and remaining branches.

Do not ask questions merely to be exhaustive. A question is material when
different answers would change scope, externally visible behavior, architecture,
compatibility, risk, implementation sequencing, or acceptance criteria.

### Question Format

Use this shape for each substantive grilling question:

```text
Which scope should this change cover?

1. Account chooser only (recommended): establishes the entry flow first.
2. Chooser and account creation: includes creating a test account.
3. Chooser, creation, and restoration: includes both account setup paths.
4. Other (tell me more): type your preferred scope.
```

Before sending, check: one question, numbered concrete alternatives,
recommendation at 1, Other last, and free-form answers accepted. A request to
change this interview format is not an answer to the pending design question.

This is a mandatory pre-send format check for every substantive grilling
question, including the first question and any re-presented question. Do not
replace the choices with an open-ended question or a recommendation paragraph
followed by a yes/no question. Keep the recommendation inside option 1 and
keep `Other (tell me more)` as the final option. If a format correction is
requested, preserve the pending decision and its question number; the
correction does not resolve that decision or advance the interview.

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

## Turn Feedback Into Artifact Updates

The interview must improve the target artifacts, not merely produce questions
or a chat summary. Track which conclusions the user actually confirmed and
which recommendations remain unanswered.

- When the user explicitly asks to update the target artifacts from their
  feedback, apply the established conclusions within that authorized scope.
  Do not ask for the same authorization again or wait for unrelated questions
  to be resolved before capturing a settled conclusion.
- Revise the relevant existing wording, examples, and constraints coherently;
  do not append a transcript while leaving contradictory guidance in place.
- For a standalone document, update that document directly. Creating a new
  OpenSpec change or changing other instruction files requires separate scope.
- Keep unanswered questions and deferred choices explicit. Neither silence,
  a skipped question, nor the assistant's recommendation establishes a decision.
- After each authorized update, verify the result, summarize the actual
  changes, and give clickable links to every changed artifact.
- If the user has only answered interview questions without authorizing
  artifact writes, summarize the proposed edits and obtain confirmation first.

## Reconcile OpenSpec Artifacts

After the Completion Test is satisfied, or after an explicit question budget is
exhausted, map each established conclusion to the artifact whose schema
instructions own that information. Reconcile existing artifacts so scope,
requirements, design, and tasks do not contradict one another.

- Existing change: follow the `openspec-update-change` workflow. Propose exact
  revisions and reasons, obtain its required confirmations, and edit only paths
  already listed in `existingOutputPaths`.
- No change yet and an OpenSpec proposal is the requested target: identify the
  proposed change name and planning artifacts. If
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

The requested outcome is coherent, user-confirmed planning artifacts, whether
OpenSpec artifacts or the user's named planning document, not merely an
interview transcript.
