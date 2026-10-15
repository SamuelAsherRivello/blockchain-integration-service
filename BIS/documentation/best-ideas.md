# Best Ideas

## Project structure

- Keep the repository root as the workspace boundary.
- Put each independently runnable project in its own `project-name/` directory. This supports multiple technologies and runtimes within one repository, without mixing their source, dependencies, tooling, or build output.
- Keep that project's source in `project-name/src/`, separated by runtime concern:
  - `src/client/` for browser UI and client-only behavior.
  - `src/server/` for server handlers, jobs, and server-only integrations.
  - Keep the `client`/`server` boundary in mind from the start so the project can grow into a cross-platform client/server solution. A project may initially contain only one side; create the other when it is needed.
  - `src/shared/` for framework-neutral types, validation, utilities, and contracts that both client and server may import.
- Keep project-specific automation in `project-name/scripts/`, rather than at the repository root or inside a client/server runtime folder.
- Let each project own its `package.json`, TypeScript configuration, tests, and build configuration.
- Extract code into a workspace package only when more than one project needs it; do not import directly across another project's `src/` boundary.
- Keep language-specific starter templates under `templates/<language>/`; the project structure itself remains language-independent.

```text
REPO/
├── templates/
│   └── typescript/
│       └── class.template.ts
└── project-name/
    ├── src/
    │   ├── client/
    │   │   ├── app/
    │   │   └── features/
    │   ├── server/
    │   │   ├── api/
    │   │   └── jobs/
    │   └── shared/
    │       ├── contracts/
    │       ├── types/
    │       └── utils/
    ├── scripts/
    ├── tests/
    ├── package.json
    └── tsconfig.json
```

## Language-specific templates

The shared structure above applies to projects in any language. When a project
needs a starting point for a language-specific construct, keep a small,
reviewable template outside runtime source code. For TypeScript, see
[`templates/typescript/class.template.ts`](templates/typescript/class.template.ts).
