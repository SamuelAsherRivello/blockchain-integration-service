I’d consolidate the repeated format rules, keep numbering stable during clarifications, and distinguish confirmed decisions from recommendations. I’d also allow two concrete choices for genuinely binary decisions and remove the  
---
name: open-spec-grill-me
description: Interview the user about an OpenSpec exploration, proposal, or standalone plan using consistent numbered choices and a recommended answer. Investigate codebase facts directly and reconcile confirmed decisions into authorized planning artifacts. Planning only; never implements code.
---

# Open Spec Grill Me

Resolve material ambiguity through an adaptive, one-question-at-a-time
interview. Turn confirmed decisions into coherent planning artifacts when
authorized. Never edit implementation code or start implementation.

## Establish Context

1. Identify the target from the user's request and conversation.
   - For a named standalone document, read and refine that document.
   - For an OpenSpec change, resolve it from explicit input, conversation
     context, or the only active change.
   - If several targets are plausible, ask the user to select one.
   - Do not create an OpenSpec change merely to interview a standalone plan.

2. Follow repository instructions for OpenSpec setup and canonical paths.
   Run OpenSpec commands from the repository root.

3. For an OpenSpec target, use `openspec list --json` and
   `openspec status --change "<name>" --json` as applicable.
   Read the existing artifacts reported by the CLI.
   Use the reported schema, paths, dependencies, and action context.
   Do not assume artifact names or invent unavailable CLI fields.
   If the CLI differs from these instructions, inspect its help.

4. Read the resolved OpenSpec root's `config.yaml` or `config.yml`,
   when present. Apply its context and artifact rules as constraints.

5. If the user selected a registered standalone store, preserve
   `--store <id>` on commands that support it.

6. Where the repository uses `C###` and `C###-T###` identifiers,
   preserve them as stable identities. Display the change's ID and
   human-readable name together. Do not invent IDs for repositories
   that do not use this convention.

## Choose the Next Decision

Maintain a working list of:
- Confirmed decisions.
- Facts established from evidence.
- Unconfirmed recommendations and assumptions.
- Open or explicitly deferred decisions.

Explore relevant branches: goals, users, scope, behavior, states, data,
interfaces, integrations, failures, security, compatibility, migration,
operations, testing, acceptance criteria, rollout, and non-goals.

Investigate before asking. Use repository files, specs, tests, history,
configuration, and read-only commands to resolve factual questions.
Report the evidence briefly; ask the user about preferences and tradeoffs
that the evidence cannot settle.

Ask only material questions. A question is material when its answer changes
scope, observable behavior, architecture, compatibility, risk, sequencing,
or acceptance criteria.

After every answer, re-rank the remaining decisions:
1. Resolve prerequisites before dependent decisions.
2. Prioritize consequential uncertainty and potential rework.
3. Revisit affected decisions when an earlier answer changes.
4. Omit branches that do not apply.

Challenge vague requirements by turning them into observable behavior
or measurable acceptance criteria. Probe contradictions without reopening
settled decisions unnecessarily.

## Question Budget

- A single positive integer supplied as the invocation argument is the
  maximum number of substantive questions:
  `$open-spec-grill-me 3` means at most three questions.
- A number replying to a pending question selects that question's option;
  it does not reset the budget.
- Honor explicit limits such as "ask me five questions."
- With a budget, label questions `Question N of M`.
- Without a budget, label questions `Question N`.
- Ask one substantive decision per question. Do not hide multiple decisions
  inside one question to stay within the budget.
- Count a substantive question when first presented.
- Reformatting, repeating, or explaining the same question does not consume
  another question. Preserve its number.
- A follow-up that introduces a new substantive decision consumes a question.
- Target selection and necessary artifact-write confirmation do not count,
  but must not introduce additional design decisions.
- At the limit, stop asking design questions. Summarize confirmed decisions
  and unresolved branches. Do not add a final correction question.
- With no limit, continue until the Completion Test is satisfied or the user
  asks to stop.

## Mandatory Question Format

Present interview questions directly in chat. Do not use question widgets
or user-input tools. End the turn after the question and wait for the reply.

Use this exact structure:

### Question N of M — Short decision title

One focused question?

1. **Concrete answer (recommended)** — Brief reason to choose it.
2. **Concrete alternative** — Main consequence or tradeoff.
3. **Concrete alternative** — Main consequence or tradeoff.
4. **Other (tell me more)** — Describe your preferred answer.

Reply with a number or your own answer. You can also say “skip.”

### Formatting Rules

- Omit `of M` when there is no question budget.
- Use consecutive Arabic numbers starting at `1`.
- Put the recommended answer first and use exactly `(recommended)`.
- Keep the recommendation and its rationale inside option 1.
- Normally provide three concrete choices plus Other.
- For a genuinely binary decision, provide two concrete choices plus Other.
  Do not invent an artificial third choice.
- Add further concrete choices only when they represent useful alternatives.
- Always place **Other (tell me more)** last and number it consecutively.
- Make choices concrete, distinct, and comparable in scope and detail.
- State what each choice means; avoid vague labels such as “simple,”
  “balanced,” or “advanced” without explaining the behavior.
- Default to one choice per question. If several independent selections are
  needed, split them into separate decisions.
- Keep each option to one short sentence where practical.
- Include at most two short context sentences before the question when
  evidence or a dependency needs explanation.
- Do not add another question after the options.
- Use the same numbered-choice structure for target selection or required
  write confirmation, but label those separately from the question budget.

### Example

### Question 2 of 5 — Account scope

Which account flows should this change include?

1. **Account chooser only (recommended)** — Establishes the entry flow with the smallest implementation scope.
2. **Chooser and account creation** — Adds the ability to create a test account.
3. **Chooser, creation, and restoration** — Includes both account setup paths.
4. **Other (tell me more)** — Describe your preferred scope.

Reply with a number or your own answer. You can also say “skip.”

### Pre-Send Check

Before every question, including the first and any repeated question, verify:
- One focused decision.
- Correct question number and remaining budget.
- Numbered, distinct choices.
- Recommended answer at option 1.
- Other as the final option.
- Free-form replies and skipping explicitly allowed.
- No second question or implied default selection.

## Interpret Replies

- Accept an option number, option wording, or a free-form answer.
- Never treat a recommendation, silence, or an unanswered question as consent.
- Record a clear answer as confirmed, including any qualifications the user adds.
- If a reply combines choices coherently, record the combined answer.
  If the choices conflict, clarify the pending decision without silently
  choosing for the user.
- “Skip” leaves the decision unresolved; do not supply an assumed answer.
- A request to explain or reformat a question does not answer it.
  Explain or re-present the same decision with its original number.
- If the user asks a side question, answer it before returning to the pending
  decision. Do not advance the interview automatically.
- When an answer supersedes an earlier decision, record the replacement and
  identify any affected planning conclusions.

Periodically summarize settled decisions and remaining uncertainty.
Keep these summaries brief; do not repeat the full interview history.

## Completion Test

The interview is complete when the relevant planning detail is sufficient
to explain, without inventing facts:
- The problem, users, intended outcome, and non-goals.
- End-to-end behavior, important states, failures, and edge cases.
- The chosen approach and material tradeoffs.
- Affected systems and compatibility or migration consequences.
- Verifiable acceptance criteria and an implementation-ready boundary.
- Remaining uncertainty and why it can safely be deferred.

Scale this test to the target. Do not require irrelevant detail or ask
questions merely to fill every category.

Show a concise shared-understanding summary. If budget remains and
confirmation would resolve material uncertainty, use the mandatory
question format and count it as a substantive question.

If the budget is exhausted before the test passes, state that the interview
is budget-limited and identify the unresolved decisions. Do not describe
the plan as implementation-ready.

## Turn Decisions Into Artifact Updates

Track authorization separately from design decisions.

- When the user has explicitly authorized updating the target artifacts,
  apply confirmed conclusions within that scope. Do not request the same
  permission again.
- Answers to interview questions alone do not authorize file edits.
  Without write authorization, prepare concrete proposed revisions for review.
- Capture settled conclusions without waiting for unrelated questions when
  updates are already authorized.
- Revise existing wording coherently. Remove contradictions rather than
  appending a transcript or a competing set of instructions.
- Preserve unanswered recommendations as unresolved, not approved.
- For a standalone document, update that document. Do not create a change
  or modify unrelated instruction files without authorization.
- If a decision substantially changes the target's intent, explain the scope
  shift and propose a separate change rather than silently repurposing it.

## Reconcile OpenSpec Artifacts

At completion or budget exhaustion:

1. Map each confirmed conclusion to the artifact that owns it.
2. Reconcile scope, requirements, design, and tasks so they agree.
3. Preserve unresolved items as explicit open questions, assumptions,
   deferred work, or non-goals, as appropriate.
4. For an existing change, follow `openspec-update-change` when available
   and stay within the authorized artifact scope.
5. If no change exists and proposal creation is authorized, follow
   `openspec-propose` when available. Do not fabricate decisions to complete
   required artifacts.
6. Follow the actual installed schema and workflow. Report missing
   capabilities rather than inventing commands or required fields.
7. Validate edited artifacts using the repository's supported workflow.

Finish with:
- Confirmed decisions and actual artifact changes.
- Clickable links to changed artifacts.
- Remaining unresolved decisions.
- Whether planning is complete or further decisions are needed.

Never start implementation during this invocation.