# Proposal

## Why

The project-run helper can report success from startup log text before a Vite listener exists, can lose a detached server when its invoking shell exits, and can mistake unavailable process inspection for proof that a port is unrelated. These behaviors caused the recent restart to advertise port 5175 even though no server remained there, preventing reliable local preview startup.

## What Changes

- Make startup success require a live listener, a reachable HTTP route, and the expected response identity; log text alone is diagnostic evidence only.
- Recover from port races, stale project-owned process trees, sidecar-port conflicts, detached-process loss, and sandbox loopback restrictions without killing unrelated projects.
- Keep one verified project server alive and return its actual port and verification state.
- Align the start, stop, and status skills around shared ownership, process-tree, listener, and HTTP-health evidence.
- Add focused recovery tests for fallback ports, early diagnostics, sidecar tolerance, duplicate reconciliation, and host-verification-pending behavior.

## Capabilities

### New Capabilities

None. This is a tooling-skill and launcher reliability change; it does not introduce a new product capability.

### Modified Capabilities

None. The existing `project-run-start-recovery` specification already describes the intended behavior; this change brings the implementation and agent skills into compliance.

## Impact

- `.agents/skills/ai-skills-project-run-start/run-project.ps1`
- `.agents/skills/ai-skills-project-run-start/SKILL.md`
- `C:\Users\srive\.agents\skills\ai-skills-project-run-stop\SKILL.md`
- `C:\Users\srive\.agents\skills\ai-skills-project-run-status\SKILL.md`
- `BIS/scripts/project-run-recovery.test.mjs` and related launcher checks
- No application runtime, package dependency, or public route changes.
