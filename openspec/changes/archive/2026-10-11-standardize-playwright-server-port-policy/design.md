# Design

## Context

The shared Playwright skill is installed outside this repository, while the
project-specific run-start, run-status, and run-stop skills live in this
repository. The run-start skill already owns process cleanup, fallback-port
selection, route verification, and the one-server invariant. The Playwright
skill should invoke those capabilities instead of duplicating or improvising
server management.

## Goals / Non-Goals

**Goals:**

- Make project-server lifecycle ownership explicit in Playwright workflows.
- Standardize AI-launched development servers on ports `6000-6999`.
- Preserve the existing human-run range of `5000-5999` as a coordination
  convention.
- Require verification of the actual selected port before browser automation.

**Non-Goals:**

- Changing the repository's Vite launcher, preferred port, or route topology.
- Adding a new server manager or changing Playwright command syntax.
- Modifying application code, dependencies, or production behavior.

## Decisions

1. **Delegate lifecycle operations to the project run skills.** The Playwright
   guidance will link to `ai-skills-project-run-start` for startup/restart,
   `ai-skills-project-run-status` for read-only inspection, and
   `ai-skills-project-run-stop` for shutdown. This keeps ownership checks and
   process-tree handling in the project-specific source of truth.

2. **Use a dedicated AI port range.** AI-started servers will request and
   remain within `6000-6999`; human-started servers are conventionally within
   `5000-5999`. The guidance will require checking availability and reporting
   the actual port returned by the run skill, rather than assuming a preferred
   port.

3. **Keep browser verification downstream of server verification.** Agents
   must complete status/health checks and obtain a verified URL before running
   Playwright navigation. Playwright itself will not kill arbitrary Node,
   npm, or Vite processes.

## Risks / Trade-offs

- [Existing projects may declare a port outside the convention] -> The
  project run skill remains authoritative for that project's configured
  topology; the Playwright guidance applies the AI range when the agent starts
  a server and requires reporting any explicit incompatibility.
- [A range can be exhausted] -> Use the run skill's scoped fallback behavior
  and report when no port in `6000-6999` is available; never take over another
  project's listener.
