# Triage Standards

This is the complete, active standards baseline shipped with `triage-standardize`. It is intentionally language-agnostic and can be used immediately. A user may edit this file in place to make project-specific decisions; no copy to `docs/` or setup-generated standards file is required.

## Baseline status

- **Status:** Shipped default
- **Customization:** Edit this file directly. Change Status to `Customized for <repository or scope>` and record project-specific decisions in the sections below.
- **Precedence:** Repository instructions and `.aiignore` always take precedence. A documented project-specific decision here takes precedence over a generic default in this file.

## Purpose and scope

Use this baseline to assess three concerns without prescribing one framework or language:

- project and file organization;
- class/object contracts and responsibilities; and
- AI readiness and safe agent-operation boundaries.

Apply only the sections relevant to the repository. Preserve established framework conventions and record intentional deviations in **Exceptions and deferred decisions**.

## Score weights

| # | Category | Default weight |
| --- | --- | --- |
| WEIGHT01 | Standardization | 50 |
| WEIGHT02 | Architecture | 50 |

The default is an equal blend. A customization may change the weights only when it states the reason and the weights still total 100.

## Project template

Use this tree as a decision aid, not as a mandate to create empty directories or force a monorepo layout. Rename or omit parts that do not express a real runtime, deployable, technology, or ownership boundary.

```text
REPOSITORY/
|-- AGENTS.md                         # canonical collaboration and safety guidance
|-- README.md                          # entry point, architecture summary, verified commands
|-- .aiignore                          # optional protected paths for AI-assisted work
|-- docs/
|   |-- architecture/                  # durable diagrams/decisions when warranted
|   `-- operations/                    # deployment, support, or runbook material
|-- project-name/                      # primary product/runtime/ownership boundary
|   `-- feature-or-service/
|       |-- src/
|       |   |-- client/                # presentation/input boundary, when applicable
|       |   |-- server/                # transport/runtime boundary, when applicable
|       |   |-- shared/                # deliberately shared contracts/value types
|       |   `-- modules/               # cohesive domain/application modules
|       |-- tests/                     # tests nearest the boundary they verify
|       |-- public-or-assets/          # runtime assets, when applicable
|       `-- feature-or-service README  # boundary, entry points, verification
|-- scripts/                           # repeatable repository automation
|-- config/                            # explicit tool/runtime configuration, if centralized
`-- output/                            # ignored reports and generated diagnostics
```

### Project-template expectations

- A `project-name` represents a real technology, runtime, deployable, or ownership boundary—not merely a folder preference.
- When a project is exceptionally organized into packages, place the package tier between `project-name` and `feature-or-service`. This is uncommon and must represent a real boundary, not a folder preference.
- Keep source, tests, configuration, and documentation close to the boundary they serve when that makes ownership clearer.
- Use `client`, `server`, and `shared` only where those concepts exist. `shared` must not become an unowned dumping ground.
- Document public entry points and supported commands near the durable boundary they serve.
- Preserve valid framework/tooling layouts and document intentional deviations here.

React and TypeScript illustration: a browser package may keep React composition and UI adapters in `src/client/`, while stable contracts and value types that do not import UI code live in `src/shared/`. This is an example, not a universal tree.

## Class template

Use this as a language-neutral ordering and contract guide. Adapt syntax to the active language and omit inapplicable sections. Prefer a function or data type when there is no cohesive lifecycle, state boundary, polymorphic substitution, or injected collaboration to model.

```text
File: <responsibility-oriented-name>

Imports / dependencies
Public contract(s): interface, protocol, abstract type, or equivalent expectation

Class <ConcreteResponsibility> implements <PublicContract>
  Public constants and stable defaults
  Private state
  Constructor / dependency injection
  Public operations grouped by caller intent
  Protected extension points, only when a stable inheritance contract exists
  Private helpers grouped by the operation they support

Companion exports: factories, value types, errors, or test fakes when they belong here
```

### Class-template expectations

- The file name, primary type, and public contract communicate one responsibility.
- Expose the smallest useful public API. Keep mutable state private and name its owner.
- Depend on contracts or stable abstractions at meaningful boundaries; inject collaborators where it improves substitution and testing.
- Favor composition over inheritance. Use inheritance only for a documented substitutability relationship.
- Separate transport/UI adapters from domain/application logic; keep framework-specific code at its boundary.
- Keep construction, validation, errors, and lifecycle expectations visible to callers.
- Co-locate small contracts with their single consumer/provider; promote only genuinely shared contracts.

React and TypeScript illustration:

```ts
export interface Clock {
  now(): Date;
}

export class SessionExpiryPolicy {
  private readonly clock: Clock;

  public constructor(clock: Clock) {
    this.clock = clock;
  }

  public isExpired(expiresAt: Date): boolean {
    return this.clock.now() >= expiresAt;
  }
}
```

This illustrates an explicit contract and injected dependency; it does not imply every component needs a class.

## AI readiness

Assess each applicable area as `nailed`, `partial`, `missing`, or `N/A`, and record the canonical source rather than copying volatile instructions.

| # | Area | Good local outcome | Evidence to record |
| --- | --- | --- | --- |
| READY01 | Canonical agent instructions | One discoverable source states scope, constraints, and protected areas. | Instruction path and precedence. |
| READY02 | Command discovery | Build, test, lint, type-check, and release commands are findable and distinguish verified from illustrative. | Scripts, CI, or runbook paths. |
| READY03 | Project orientation | A newcomer can locate primary modules, public entry points, and ownership boundaries. | README, module map, or architecture note. |
| READY04 | Definition of done | Proportionate verification, review, and documentation expectations are stated. | Contribution guidance, CI, or checklist. |
| READY05 | Maintenance relationships | Documentation, generated outputs, tests, and implementation identify what changes together. | Linked files and update rules. |
| READY06 | Safety boundaries | Ignore rules, secret handling, generated-output rules, and protected paths prevent accidental overreach. | `.aiignore`, `.gitignore`, security guidance, and repository instructions. |

`.aiignore` is optional. Do not add it blindly: propose only repository-specific exclusions, explain each pattern, and obtain approval before creating or changing it.

## Verification

Record supported commands, the scope they cover, and when they are expected to run. Do not represent a discovered command as passing unless it was run and its result was captured.

## Exceptions and deferred decisions

Record intentional deviations, their owner, reason, and review trigger. A documented exception is not a newly actionable violation; an undecided item remains a decision rather than an implied rule.
