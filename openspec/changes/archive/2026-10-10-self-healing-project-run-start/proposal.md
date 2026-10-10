# Proposal

## Why

The project-run skill currently treats routine local-development conditions as
terminal failures: an occupied port, a stale child process, a launcher race, a
sidecar port conflict, or sandbox loopback restrictions can prevent a usable
preview even when recovery is straightforward. This change makes starting the
project an autonomous recovery workflow that preserves unrelated services,
selects a working port, and returns a usable running server whenever the host
can support one.

## What Changes

- Add deterministic ownership detection and process-tree cleanup for servers
  belonging to the current repository.
- Restart an owned server on the declared preferred port after cleanup.
- Preserve unrelated listeners and advance through a dedicated fallback port
  range when the preferred port is unavailable.
- Retry launch races such as `EADDRINUSE` without creating duplicate servers.
- Use the repository's authoritative `npm run dev` command rather than assuming
  a root Vite configuration file.
- Treat an independently occupied optional faucet API port as recoverable when
  the shared Vite server is healthy.
- Separate server-start success from route-verification limitations caused by
  sandbox networking, while retaining the live server for host-level use.
- Return the actual selected port and per-route verification state.

## Capabilities

### New Capabilities

- `project-run-start-recovery`: Self-healing startup, port selection, process
  ownership, route verification, and result reporting for the local shared
  project server.

### Modified Capabilities

- None.

## Impact

- `.agents/skills/ai-skills-project-run-start/SKILL.md`
- `.agents/skills/ai-skills-project-run-start/run-project.ps1`
- `BIS/scripts/dev-all.mjs` if faucet sidecar port selection requires a small
  compatibility extension.
- `BIS/scripts/project-run-config.mjs` only if the fallback range or startup
  contract becomes project-configurable.
- Local Windows process, port, and HTTP verification behavior; no production
  API or persisted application data changes.
