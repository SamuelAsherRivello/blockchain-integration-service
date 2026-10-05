# Project Template

Adapt this reference to the repository's runtime and delivery boundaries. It is a discussion tool, not a mandate to create empty directories or convert every project into the same layout.

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

## Adaptation rules

- A `project-name` is a technology, runtime, deployable, or ownership boundary - not merely a folder preference.
- When a project is exceptionally organized into packages, put the package tier between `project-name` and `feature-or-service`. This is rare and must represent a real boundary, not merely a folder preference.
- Keep source, tests, configuration, and documentation close to the boundary they serve when that makes ownership clearer.
- Use `client`, `server`, and `shared` only where those concepts exist. `shared` must not become an unowned dumping ground.
- Describe public entry points and supported commands in the closest durable documentation.
- Preserve framework conventions and existing valid tooling layouts; document intentional deviations in the standards file.

### React and TypeScript illustration

For a browser package, `src/client/` may contain React composition and UI adapters, while `src/shared/` contains stable contracts and value types that do not import UI code. This is an example, not a universal tree.
