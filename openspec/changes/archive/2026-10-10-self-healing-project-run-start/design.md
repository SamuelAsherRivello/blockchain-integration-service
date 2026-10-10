# Design

## Context

See `proposal.md` for motivation. The repository uses one shared Vite server
launched by `npm run dev`, with routes declared by
`BIS/scripts/project-run-config.mjs`. The launcher also attempts an optional
faucet API on a separate fixed port.

## Goals / Non-Goals

**Goals:**

- Make startup resilient to owned and unrelated port conflicts.
- Preserve the one-project-server invariant.
- Make process ownership and fallback selection observable in the result.
- Keep a usable Vite server alive when optional sidecar or sandbox checks fail.

**Non-Goals:**

- Changing production application behavior.
- Killing processes whose ownership cannot be established.
- Starting one server per package.
- Hiding a genuine route or launcher failure.

## Decisions

1. The helper will treat the project root plus command context as the ownership
   key. Windows process enumeration will have a `netstat`/PID fallback for
   environments where CIM queries are unavailable. An unknown listener is
   preserved and causes candidate-port advancement.

2. Candidate ports will be attempted sequentially from the configured
   preferred port through a bounded dedicated range. The actual launch attempt,
   not only a preflight probe, is authoritative for handling bind races.

3. Launch success will require a selected listener or an unambiguous project
   launcher marker. Route checks will then classify each route as verified or
   host-verification-pending. A blocked check must not tear down a healthy
   server.

4. The helper will invoke `npm run dev` directly with host, port, and optional
   HMR arguments. It will not inject a root `vite.config.js` that the project
   does not declare.

5. The faucet sidecar remains optional to the Vite startup contract. If its
   port is occupied, the result records that condition separately. If product
   requirements later demand a fresh faucet API, the launcher should gain an
   explicit configurable sidecar port rather than silently taking over another
   process.

## Risks / Trade-offs

- [Risk] A blocked HTTP probe can reduce verification confidence. -> Mitigation:
  distinguish pending host verification from startup failure and retain the
  process for the user's browser.
- [Risk] Process ownership checks can be incomplete under restricted Windows
  permissions. -> Mitigation: use conservative PID fallbacks and never stop an
  unverified listener.
- [Risk] A sidecar may be stale while its port is reachable. -> Mitigation:
  health-check the existing endpoint before classifying it as usable.
- [Risk] Fallback ports can make remembered URLs stale. -> Mitigation: always
  return the selected port and route URLs in the result.
