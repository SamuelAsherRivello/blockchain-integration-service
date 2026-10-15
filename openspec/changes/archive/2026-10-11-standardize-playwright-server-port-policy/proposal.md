# Proposal

## Why

Playwright browser automation currently has no mandatory project-server lifecycle guidance, so agents can start duplicate development servers, inspect the wrong process, or collide with another agent's port. The skill should consistently delegate server ownership and health checks to the project's run skills and reserve a predictable port range for AI-launched servers.

## What Changes

- Require Playwright workflows against a local project to use `ai-skills-project-run-start` for starting or restarting the project server.
- Require `ai-skills-project-run-status` for read-only port, process, ownership, and route checks.
- Require `ai-skills-project-run-stop` when the Playwright workflow must stop the project server.
- Reserve ports `6000-6999` for servers started by AI agents; document `5000-5999` as the human-run range.
- Require AI-launched servers to remain within the AI range and to report the actual verified port.

## Capabilities

### New Capabilities

- None. This is a tooling-skill policy and does not add product behavior.

### Modified Capabilities

- None. The change affects agent workflow instructions only.

## Impact

- Updates the shared `playwright-cli` skill at `C:\Users\srive\.agents\skills\playwright-cli\SKILL.md`.
- References the repository-local project run-start, run-status, and run-stop skills without changing the project runtime or Vite configuration.
- No application APIs, dependencies, or production routes change.
