# Tasks

## 1. Update Playwright lifecycle guidance

- [x] 1.1 Add a project-server lifecycle section to `C:\Users\srive\.agents\skills\playwright-cli\SKILL.md` that requires `ai-skills-project-run-start` before starting or restarting a local project server, `ai-skills-project-run-status` for read-only process/port/route checks, and `ai-skills-project-run-stop` when stopping it; verify the three required skill references and ownership rules are present in the file.
- [x] 1.2 Document the port convention in the same skill: human-run servers use `5000-5999`, AI-spawned servers use `6000-6999`, and AI workflows must verify and report the actual selected port; verify no AI server instruction permits ports outside `6000-6999`.

## 2. Validate the change

- [x] 2.1 Run `openspec validate "standardize-playwright-server-port-policy" --type change --strict --json` and verify the change validates with specs intentionally skipped as tooling-only guidance.
- [x] 2.2 Re-read the edited skill and confirm the lifecycle sequence prevents duplicate or unowned server management while preserving normal Playwright browser commands.
