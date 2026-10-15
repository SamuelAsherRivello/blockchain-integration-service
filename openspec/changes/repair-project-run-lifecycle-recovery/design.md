# Design

## Context

See proposal.md for the motivation. The current helper uses `Project run mode:` as an early-success condition, launches through a detached hidden `cmd.exe`, and falls back to process inspection that may be unavailable in the managed shell. The repository launcher starts Vite first and treats the faucet API as optional, while the three lifecycle skills currently describe related but inconsistent evidence requirements.

## Goals / Non-Goals

**Goals:**

- Make the helper converge on zero or one project-owned server without relying on a single Windows inspection API.
- Distinguish launch diagnostics, listener proof, HTTP health, response identity, and sidecar health.
- Preserve a healthy server when verification is blocked by the observation environment.
- Give stop and status the same ownership and evidence model as start.

**Non-Goals:**

- Changing the Vite launcher’s shared route topology or application behavior.
- Taking over ports owned by another project.
- Claiming a route is verified when only a process or startup log is present.

## Decisions

1. **Listener-first acceptance.** A candidate is accepted only after its listener belongs to the launched process or is proven to serve the configured routes. Startup log text can shorten diagnostics but cannot establish success.

2. **Bounded retry state machine.** For each candidate, launch, poll for process/listener readiness, inspect exit diagnostics, and classify only known transient bind/cleanup/sidecar conditions as retryable. Kill failed candidate trees before advancing.

3. **Attached lifetime fallback.** Prefer the helper’s controlled child process, but if the host cannot retain a detached child, return a live-session launch path rather than advertising a dead server. The skill must keep the returned process/session identity available to the caller.

4. **Evidence tiers.** Ownership uses command context and process ancestry; health uses listener plus HTTP; identity uses configured labels, title, or marker. If HTTP observation is blocked while listener/process evidence is healthy, retain the server and report `host-verification-pending`.

5. **Optional sidecar isolation.** A faucet conflict does not invalidate Vite. The helper records sidecar state and uses a fallback sidecar port when the launcher supports it; route verification continues for the main server.

## Risks / Trade-offs

- [Managed environments may deny CIM, TCP, or loopback access] -> Use layered fallbacks and preserve a demonstrably live server while making the verification limitation explicit.
- [Detached processes may outlive ownership metadata] -> Reconcile by normalized command context and parent/child traversal before every launch and after every retry.
- [A false-positive HTTP response may come from another project] -> Require the configured application identity or distinctive marker, not status 200 alone.

## Migration Plan

Update the helper and skills in place, run the recovery test suite, then run the lifecycle commands against the configured shared routes. No data migration or rollback script is required; reverting the helper and skill files restores the prior behavior.
