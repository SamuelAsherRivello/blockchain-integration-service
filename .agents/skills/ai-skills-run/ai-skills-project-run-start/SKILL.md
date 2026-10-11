---
name: ai-skills-project-run-start
description: Restart exactly one Vite development server for the current project, verify it without opening browser windows, and report application-named links.
---

# Project Run Start

Use this skill when the user asks to run, start, host, or preview the current
local web project.

## Invariant

There must be exactly zero or one development Vite server for the project
directory. A start request means restart: identify every Vite/npm/node process
owned by this project, stop those project-owned process trees, verify they are
gone, and then launch exactly one fresh server. Never stop another project's
server and never run a second Vite for the same project.

## Start

For the fast path, after reading the repository config, invoke the sibling
`run-project.ps1` helper once with `-ProjectRoot`, `-Port`, and the routes JSON.
When the user requests a stable manual-testing session, pass the optional
`-DisableHmr` switch; the repo launcher must receive `--no-hmr` and serve the
same routes without Vite hot-module replacement or automatic full-page reload.
It performs scoped process cleanup and waits for terminated process trees to
exit, scans the declared dedicated port range,
launches `npm run dev -- --host 127.0.0.1 --port` on the first available port,
waits with 50 ms polling for a cold start, and verifies every route in one
host-level operation. It returns compact JSON including the selected port,
HTTP status, and HTML title. The helper MUST recover from routine port,
process, sidecar, and verification conditions: restart this project's server
when it owns the port, preserve unrelated listeners and choose a fallback
port, retry launch races, keep a healthy Vite server when the optional faucet
sidecar conflicts, and retain a live server when sandbox loopback checks are
blocked. These are recovery cases, not reasons to stop and report failure.
Startup log text is diagnostic only; a candidate is not ready until its
listener and configured-route health are proven.

1. Read the repository `AGENTS.md`, confirm the package manager and `dev`
   script, and determine the routes the launcher exposes. If
   `BIS/scripts/project-run-config.mjs` exists, read and validate its
   `serverMode`, `preferredPort`, and `routes`; otherwise infer the single
   entry point or routes from the current launcher output and HTTP responses.
   A customized project script/config is valid and authoritative for that
   project.
2. Inspect process command lines, parent/child relationships, working
   directories, and listeners to find all existing Vite servers owned by this
   project. Ownership must be established from the project root or command
   context, never from a port number alone.
3. If any owned server exists, stop only those exact process trees. On Windows,
   use scoped process control such as `taskkill /PID <PID> /T /F` only after
   confirming each PID belongs to this project. Wait and re-scan until no
   project-owned Vite process or listener remains. If a process cannot be
   stopped promptly, preserve it and launch on the next dedicated port rather
   than reporting a routine startup blocker. Never stop an unrelated project.
4. Choose the project's declared/preferred port and probe it plus at least 20
   subsequent dedicated local ports. A listening port owned by another project
   is unavailable; do not take it over. The helper must return the actual
   selected port; never assume the preferred port was available.
5. Immediately before launch, re-scan the project one final time. If another
   invocation has started a project-owned Vite server, stop/reconcile it first
   rather than launching another.
6. Execute the real command from the project root in a live Windows PTY:
   `cmd.exe /d /c "npm run dev -- --host 127.0.0.1 --port <PORT>"`. Bind to the
   same loopback interface used for HTTP verification. Keep its returned session or
   process identity. If a detached launch loses its child, retain or recreate a
   live PTY-owned session before reporting a URL. The command must be executed before opening a terminal
   panel; `open_in_codex` only displays a session and does not type commands.
7. Enforce one server after launch: confirm the new process tree is the only
   Vite process associated with this project. If duplicates appear, stop the
   extra project-owned trees before continuing.
8. Verify the listener and HTTP response for every exposed route declared by
   the current run configuration or launcher. In `shared` mode this is one
   Vite server serving multiple package routes; in `single` mode verify the one
   entry point. Never start one Vite per package unless the project explicitly
   declares that topology.
9. Verify the expected application identity, not only Vite's startup banner. A
   listener without HTTP identity is process-only evidence, not a successful
   start.
   Use the returned HTML title and, when necessary, a distinctive application
   marker in the response. Use the host-level/local runtime when sandbox
   loopback access prevents verification.
10. Verify every reported URL in a real browser context before declaring the
    run successful. Navigate to each configured route with the browser
    verification tool, wait for the page to load, and confirm that the expected
    application identity is visible. A URL is not verified merely because
    `Invoke-WebRequest`, `curl`, a listener, or a Vite startup banner succeeds.
    If the browser shows `This site can't be reached`, `ERR_CONNECTION_REFUSED`,
    a timeout, a blank page, or another navigation failure, keep the server
    running while diagnosing the binding, tunnel, port, or process ownership;
    do not report that link as working.
11. Do not return success until both host-level HTTP checks and browser checks
    pass for every route. Report each verified route using its application
    identity/title:
    `<application name> — <verified browser URL>`.
    Use the route label when it is explicitly configured; otherwise use the
    verified HTML title. Do not substitute unrelated application names.
12. Keep the one server running after verification. If browser verification,
    loopback verification, or terminal attachment is unavailable, retain the
    live process and explicitly report the URLs as unverified; never claim they
    work and never declare startup successful merely because the observation
    environment is restricted.

Never claim a URL is working without listener and HTTP verification. Do not
install dependencies or change project configuration as part of start. All
commands in this workflow must preserve the one-Vite-per-project invariant;
never batch-launch multiple Vite servers for the same project or reuse a
project-owned process after a restart request.
