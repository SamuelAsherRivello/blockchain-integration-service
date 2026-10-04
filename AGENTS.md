# Project workflow

## Generated output

- Put temporary generated artifacts, including logs, screenshots, test reports, and diagnostic dumps, under repository-root `output/<category>/<task>/`.
- Use descriptive subfolders, for example `output/logs/wallet-subscription/`, `output/screenshots/account-dialog/`, or `output/reports/release/`. Create the destination folder before writing artifacts.
- Do not write temporary artifacts into the repository root or commit them. The existing `/output` rule in `.gitignore` covers these folders.
- Existing tool-specific conventions such as `output/playwright/` remain valid. Keep tool-managed build folders such as `dist/`, tracked documentation assets, and OpenSpec planning artifacts in their established locations.
- Never write secrets into output artifacts; an ignored folder is not secret storage.

## Package README conventions

- Name each package's primary README `<package-folder>-package-readme.md` inside its package directory, for example `BIS/packages/integration/integration-package-readme.md`.
- AI editing goal: approximately 600 words per package README, normally 550–650 words, matching the user's supplied reference length. Count reader-facing prose, headings, links, and code examples; exclude hidden AI comments. This is a length target, not a reason to pad with repeated or unverified claims.
- Explain the package's purpose, main behavior, boundaries, development entry, and verification commands in concise sections. Keep detailed history and lengthy acceptance logs in the existing documentation or OpenSpec records and link to them when useful.
- Include a working relative link back to the repository's main `README.md`. Keep its Internal Packages links, other current documentation references, and the Vite README renderer synchronized with package README filenames.
- Packages with a browser application retain their UI destinations. Packages without one, currently `integration`, use their named package README as the Vite destination.

## Commit identity

- The user-approved GitHub identity for this project is [SamuelAsherRivello](https://github.com/SamuelAsherRivello).
- Use author/committer name `Samuel Asher Rivello` and GitHub noreply email `63511769+SamuelAsherRivello@users.noreply.github.com` for authorized commits. Do not ask for this identity again on this project.
- This identity preference does not authorize Git operations by itself; the Git authorization policy still applies.

## Remote demo preview

- Treat requests such as "run a Vite server" as requests for a remote demo preview usable from the user's Windows 11 browser. Follow this workflow by default.
- "Run vite" means start or reuse the single shared Vite server with `npm run dev` from the repository root. It binds loopback port 5174 with strict port behavior and serves all four packages. Keep the server running for the preview session. When a remote preview is requested, run that command on the SSH server.
- Before sharing links, verify HTTP 200 and the expected content for all four server destinations: `/admin/` (BIS Admin), `/marketplace/` (BIS Marketplace), `/onboarding/` (Onboarding Spike), and `/integration/` (rendered Integration README). Use `http://127.0.0.1:5174` on the server. The integration library has no standalone UX; serve its README instead. A sandbox networking failure does not establish that the host server is down; use the supported escalation when needed.
- The Windows browser needs an SSH tunnel. If it is not already connected, provide this Windows PowerShell command: `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:15174:127.0.0.1:5174 contabo-srive`. Tell the user to leave that terminal open.
- Present the tunnel command on one line in a code block and tell the user to paste the entire line before pressing Enter.
- The user confirmed this mapping works on 2026-09-06: Windows port 15174 forwards to server port 5174. Port 5173 serves an unrelated project, and binding Windows port 5174 returned Permission denied. Use the confirmed mapping by default in future sessions.
- If SSH reports `channel ... open failed: connect failed: Connection refused`, check and start the remote Vite server, then verify HTTP 200; the SSH connection itself is already established. Reuse an existing working tunnel.
- Return all four Windows browser links: `http://127.0.0.1:15174/admin/`, `http://127.0.0.1:15174/marketplace/`, `http://127.0.0.1:15174/onboarding/`, and `http://127.0.0.1:15174/integration/`. Distinguish verified server availability from client tunnel connectivity; a remote agent cannot establish the Windows-side tunnel without access to that machine. For an explicitly local preview, return the same four paths on the local server port.
- The root launcher owns one Vite instance and accepts `npm run dev -- --port <port>` for isolated checks; it always uses strict port behavior. Do not use the separate workspace servers for a normal four-package preview.
- Admin and Marketplace retain their existing BIS storage namespaces and share account storage on the common origin. The standalone spike retains its own window-scoped storage. Do not migrate or erase wallet data from previous ports as part of starting the server.

## GitHub Pages release contract

- Treat every request to release or publish this project as a two-demo GitHub Pages release unless the user explicitly narrows the scope.
- The published links are **BIS Admin** at `https://samuelasherrivello.github.io/blockchain-integration-service/admin/` and **BIS Marketplace** at `https://samuelasherrivello.github.io/blockchain-integration-service/marketplace/`.
- Preserve these labels and links in the README. Every displayed Admin or Marketplace link destination SHALL append a hidden `?v=<published-version>` cache-buster query while retaining its clean label; advance both query values to the exact newly published version for every release. If their paths change by explicit request, update both links and the Pages workflow together.
- Before calling a release complete, verify the Pages workflow succeeds and both public routes return their respective application. Retain existing immutable root `/assets/` URLs because issued asset metadata depends on them.
- Do not create a duplicate release when no releasable change exists after the latest release tag.

## OpenSpec directory

- The canonical, tracked planning directory is `openspec/`.
- Before any OpenSpec command or planning-file lookup, check `openspec/` from
  the repository root. Its presence establishes the project planning home;
  never treat a missing plain `openspec/` directory as a missing OpenSpec
  project.
- Run `./openspec/setup.ps1` with PowerShell 7 before using OpenSpec on a fresh checkout. OpenSpec CLI must already be installed.
- The setup script validates the tracked `openspec` directory directly; it does not create a compatibility link.
- Treat `openspec/` as the real planning directory. Inspect, edit, and stage files there.
- Run OpenSpec commands from the repository root. CLI-reported `openspec/...` paths refer to the tracked planning files.
- Make edits and stage planning files through `openspec/`.
- Keep upstream-generated OpenSpec skills unchanged; their standard paths resolve through the compatibility link.

## Optional Grill Me

- Grill Me is optional and user-invoked with `$open-spec-grill-me`.
- It may run before proposal creation or afterward to refine existing planning artifacts.
- Follow `.agents/skills/open-spec-grill-me/SKILL.md` when invoked.
- Do not require it for every change, automatically launch an interview, or add a review artifact as a schema prerequisite.
- Keep the default `spec-driven` schema. A proposal does not require a Grill Me session.
- Grill Me is planning only; it never starts implementation.

## Project scope

- Follow `BIS/documentation/BGS_PROJECT_BRIEF.md` and later confirmed decisions in `BIS/documentation/design-discussion.md`.
- Approved structure: `BIS/packages/integration` owns runtime UI and future core/Arkade layers; `BIS/packages/integration-admin` consumes its public API and owns admin/preview composition.
- Current slice: React split-screen demo, 9:16 preview, and an Account button opening a coming-soon dialog. Arkade SDK may be installed as a dependency; no Arkade or wallet operations yet.
