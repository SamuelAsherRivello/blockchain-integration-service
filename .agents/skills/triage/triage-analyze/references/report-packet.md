# Triage Analyze report packet

Use this as the shape of a report packet. Replace the bracketed guidance with project-specific evidence; do not leave generic placeholders in the final report.

## `overview.md`

```markdown
# Triage Analysis Report

Overview · [Standardization analysis](standardization-analysis.md) · [Architecture analysis](architecture-analysis.md) · [Verification baseline](verification-baseline.md) · Back

| # | Name | Comment |
| --- | --- | --- |
| META01 | Run | [run id] |
| META02 | Scope | [repository or named scope] |
| META03 | Evidence window | [commit, dates, and exclusions] |
| META04 | Standards baseline | [`standards-document.md`](../../../../.agents/skills/triage/triage-standardize/references/standards-document.md) has not been customized by user. Using defaults. |

## Overall Repository Health

| # | Meter | Value | Comment |
| --- | --- | --- | --- |
| OVER01 | <meter value="60" min="0" max="100" low="20" high="60" optimum="90"></meter> | 60/100 | [band and one-sentence interpretation] |

The score is [final/provisional]. [Explain weights, unavailable inputs, and material evidence limits.]

## Standardization

| # | Meter | Value | Comment |
| --- | --- | --- | --- |
| STND01 | <meter value="60" min="0" max="100" low="20" high="60" optimum="90"></meter> | 60/100 | [short interpretation] |

[Link to standardization analysis.]

## Architecture

| # | Meter | Value | Comment |
| --- | --- | --- | --- |
| ARCH01 | <meter value="60" min="0" max="100" low="20" high="60" optimum="90"></meter> | 60/100 | [short interpretation] |

[Link to architecture analysis.]

## Refactor urgency

| # | Meter | Value | Comment |
| --- | --- | --- | --- |
| URGE01 | <meter value="50" min="0" max="100" low="20" high="60" optimum="90"></meter> | 50/100 | [low/medium/high/critical] |

[Explain impact, rate of change, coupling/blast radius, delivery friction, and confidence.]

## Recommended next steps

1. [Highest-value evidence-backed action and its owner skill.]
2. [Second action or deliberate deferral.]

Optional follow-up: invoke `$triage-standardize` for approved conformity and AI-readiness work, `$triage-rearchitect` for one selected structural candidate, or `$openspec-propose` to turn this evidence into a tracked change proposal.

## Optional: OpenSpec handoff

- **Suggested scope:** [bounded change]
- **Evidence:** [links to findings]
- **Non-goals:** [what this proposal must not include]
- **Unresolved questions:** [questions that need a decision]
```

## `standardization-analysis.md`

Start with: `[Overview](overview.md) · Standardization analysis · [Architecture analysis](architecture-analysis.md) · [Verification baseline](verification-baseline.md) · [Back](overview.md)`.

Cover the active baseline, project-tree alignment, class/interface consistency, naming and documentation, configuration conventions, and AI-readiness status. Every finding should state observed evidence, desired standard, delta, severity, and recommended owner. When the shipped baseline is uncustomized, use the same linked `standards-document.md has not been customized by user. Using defaults.` wording and clearly separate observed conventions from proposed standards.

Include a **Repository integrity** table when the scope permits. Classify every item as `confirmed stale`, `orphan candidate`, `intentionally future-facing`, `not assessed`, or `not applicable`. Cite the signals checked and limits on the conclusion. Do not call an unreferenced class, export, script, configuration entry, or asset dead solely from static inspection. A current-state documentation claim may be stale when contradicted by evidence or when its named target is absent; explicitly labeled `Planned`, `Proposed`, `Roadmap`, `Future`, or historical material is intentionally future-facing unless its label itself is misleading.

| # | Candidate | Classification | Evidence and limits | Recommended owner |
| --- | --- | --- | --- | --- |
| INTG01 | [path or documentation claim] | confirmed stale / orphan candidate / intentionally future-facing / not assessed / N/A | [references checked and caveats] | Standardize / Rearchitect / user decision |

For AI readiness, use a compact table:

| # | Area | Status | Evidence | Practical improvement |
| --- | --- | --- | --- | --- |
| READY01 | Canonical agent instructions | nailed / partial / missing / N/A | | |
| READY02 | Command discovery | | | |
| READY03 | Project orientation | | | |
| READY04 | Definition of done | | | |
| READY05 | Maintenance relationships | | | |
| READY06 | Safety boundaries | | | |

When `.aiignore` is absent, record it as an **optional Standardize recommendation** only when a repository-specific AI-access boundary would add protection beyond existing instructions and `.gitignore`. Do not mark its absence as a defect or reduce the readiness score solely for that reason. State the concrete risk and the candidate boundary; do not include a draft unless the user asks for one.

## `architecture-analysis.md`

Start with: `[Overview](overview.md) · [Standardization analysis](standardization-analysis.md) · Architecture analysis · [Verification baseline](verification-baseline.md) · [Back](overview.md)`.

Start with a concise module map, then describe contracts, ownership, dependency direction, communication, and pressure points. For each candidate include evidence, expected value, risk, non-goals, urgency, and whether it belongs to Standardize or Rearchitect.

## `verification-baseline.md`

Start with: `[Overview](overview.md) · [Standardization analysis](standardization-analysis.md) · [Architecture analysis](architecture-analysis.md) · Verification baseline · [Back](overview.md)`.

List discovered quality commands and their source, intended scope, whether they were run, result if run, environmental limitations, and a recommended verification sequence for later approved changes. Distinguish static/build checks from behavioral tests and manual scenarios. Discovery is not verification.

| # | Check or scenario | Source and scope | State | Result or limitation |
| --- | --- | --- | --- | --- |
| VERI01 | [command or manual scenario] | [manifest, CI, test file, or documentation] | discovered / run | passed / failed / not run, with evidence |
