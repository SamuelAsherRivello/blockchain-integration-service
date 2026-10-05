# AI Readiness Template

Record the repository's selected conventions in [the shipped standards document](standards-document.md). Assess each item as `nailed`, `partial`, `missing`, or `N/A`, with links and concrete maintenance ownership.

| # | Area | Good local outcome | Evidence to record |
| --- | --- | --- | --- |
| READY01 | Canonical agent instructions | One discoverable source explains scope, constraints, and protected areas without duplicating volatile detail. | Instruction file path and precedence. |
| READY02 | Command discovery | Build, test, lint, type-check, and release commands are findable and distinguish verified from illustrative. | Scripts, CI workflow, or runbook paths. |
| READY03 | Project orientation | A newcomer can locate primary modules, public entry points, and ownership boundaries quickly. | README, module map, or architecture note. |
| READY04 | Definition of done | The project states proportionate verification, review, and documentation expectations. | Contribution guidance, CI, or quality checklist. |
| READY05 | Maintenance relationships | Documentation, generated outputs, tests, and implementation identify what must change together. | Linked files and update rules. |
| READY06 | Safety boundaries | Ignore rules, secret handling, generated-output rules, and protected paths prevent accidental overreach. | `.aiignore`, `.gitignore`, security guidance, and repository instructions. |

Use links to canonical material rather than copying it into several files. Mark an item `N/A` only with a reason.
