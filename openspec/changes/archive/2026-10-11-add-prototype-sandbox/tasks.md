# Tasks

## 1. Package and shared shell

- [x] 1.1 Create the `prototype-sandbox` workspace package, HTML entry, React bootstrap, and package README; verify the package files and documented local command exist.
- [x] 1.2 Implement the shared title bar and functional Signet/Mutinynet selector using the existing Prototype Faucet presentation; verify the selector renders both networks and switching updates the visible selection.
- [x] 1.3 Implement the shared `Navigation` component and path-derived Demo 1–Demo 10 shell; verify the active item is non-clickable and inactive items expose navigation targets.
- [x] 1.4 Add focused browser-facing tests or deterministic component checks for active-demo parsing, ten navigation targets, and active-item disabling; verify the package test command passes.

## 2. Shared development integration

- [x] 2.1 Register `/prototype-sandbox/` in the shared Vite package route table and add the ten nested entry documents; verify direct requests to all ten demo URLs return the Sandbox entry.
- [x] 2.2 Run the shared development server and use Playwright to verify direct loading of all ten demos, exact shared title/header presentation, network selector interaction, and navigation from one demo to another.
- [x] 2.3 Run the relevant build and repository checks, review the diff for scope, and verify no unrelated working-tree changes are included in the implementation result.
