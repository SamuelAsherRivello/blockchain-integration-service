# Project workflow

## Commit identity

- The user-approved GitHub identity for this project is [SamuelAsherRivello](https://github.com/SamuelAsherRivello).
- Use author/committer name `Samuel Asher Rivello` and GitHub noreply email `63511769+SamuelAsherRivello@users.noreply.github.com` for authorized commits. Do not ask for this identity again on this project.
- This identity preference does not authorize Git operations by itself; the Git authorization policy still applies.

## Remote demo preview

- Treat requests such as "run a Vite server" as requests for a remote demo preview usable from the user's Windows 11 browser. Follow this workflow by default.
- When asked to run the demo on the SSH server, start it with `npm run dev --workspace @bis/integration-demo -- --port 5174 --strictPort` from the repository root. Keep the server running for the preview session.
- Verify that `http://127.0.0.1:5174/` returns HTTP 200 and the demo HTML before sharing the preview URL. A sandbox networking failure does not establish that the host server is down; use the supported escalation when needed.
- The Windows browser needs an SSH tunnel. If it is not already connected, provide this Windows PowerShell command: `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:15174:127.0.0.1:5174 contabo-srive`. Tell the user to leave that terminal open.
- Present the tunnel command on one line in a code block and tell the user to paste the entire line before pressing Enter.
- The user confirmed this mapping works on 2026-09-06: Windows port 15174 forwards to server port 5174. Port 5173 serves an unrelated project, and binding Windows port 5174 returned Permission denied. Use the confirmed mapping by default in future sessions.
- If SSH reports `channel ... open failed: connect failed: Connection refused`, check and start the remote Vite server, then verify HTTP 200; the SSH connection itself is already established. Reuse an existing working tunnel.
- Share `http://127.0.0.1:15174/` as the confirmed browser URL. Distinguish verified server availability from client tunnel connectivity; a remote agent cannot establish the Windows-side tunnel without access to that machine.
- Do not pass port flags through the root `npm run dev` wrapper: its nested npm invocation can pass `5173` to Vite as a directory and produce a 404.

## OpenSpec directory

- The canonical, tracked planning directory is `.openspec/`.
- Run `./.openspec/setup.ps1` with PowerShell 7 before using OpenSpec on a fresh checkout. OpenSpec CLI must already be installed.
- The setup script creates an ignored local `openspec` junction on Windows or symbolic link on other systems, pointing to `.openspec/` for stock CLI compatibility.
- Run OpenSpec commands from the repository root. CLI-reported `openspec/...` paths refer to the same files as `.openspec/...`.
- Make edits and stage planning files through `.openspec/`. Never force-add the compatibility link or create a second planning directory.
- Keep upstream-generated OpenSpec skills unchanged; their standard paths resolve through the compatibility link.

## Optional Grill Me

- Grill Me is optional and user-invoked with `$open-spec-grill-me`.
- It may run before proposal creation or afterward to refine existing planning artifacts.
- Follow `.agents/skills/open-spec-grill-me/SKILL.md` when invoked.
- Do not require it for every change, automatically launch an interview, or add a review artifact as a schema prerequisite.
- Keep the default `spec-driven` schema. A proposal does not require a Grill Me session.
- Grill Me is planning only; it never starts implementation.

## Project scope

- Follow `documentation/BGS_PROJECT_BRIEF.md` and later confirmed decisions in `documentation/design-discussion.md`.
- Approved structure: `packages/integration` owns runtime UI and future core/Arkade layers; `packages/integration-demo` consumes its public API and owns admin/preview composition.
- Current slice: React split-screen demo, 9:16 preview, and an Account button opening a coming-soon dialog. Arkade SDK may be installed as a dependency; no Arkade or wallet operations yet.
