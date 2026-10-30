# Project workflow

## Commit quality

- Make only purposeful commits. Each commit must be atomic: include one coherent, well-designed change and every file required for it.
- Write a concise commit message that accurately describes the change's purpose and outcome.

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

### ChatGPT terminal workflow

This local ChatGPT-terminal workflow takes precedence for ordinary user requests to run Vite or run the project. Use the remote SSH preview workflow below only when the user explicitly requests a remote preview.

- When the user says "run Vite," "run the project," or equivalent, open a terminal tab beside the current ChatGPT tab using the Codex terminal panel.
- Run from the repository root with `npm run dev`. The shared frontend port is fixed at `5174`; the faucet API port is fixed at `5190`.
- Keep the terminal session running, verify the Admin and Marketplace routes, and return their URLs only after the server is running.
- Reuse a healthy ownership-verified server on `5174`. Never stop it, replace it, or choose another port during an ordinary start. Report occupied, unhealthy or unverified listeners for explicit resolution. Stealth & Steel owns `5176`.

- Treat requests such as "run a Vite server" as requests for a remote demo preview usable from the user's Windows 11 browser. Follow this workflow by default.
- "Run vite" means start or reuse the single shared Vite server with `npm run dev` from the repository root. It binds loopback port 5174 with strict port behavior and serves all four packages. Keep the server running for the preview session. When a remote preview is requested, run that command on the SSH server.
- Before sharing links, verify HTTP 200 and the expected content for all four server destinations: `/admin/` (BIS Admin), `/marketplace/` (BIS Marketplace), `/onboarding/` (Onboarding Spike), and `/integration/` (rendered Integration README). Use `http://127.0.0.1:5174` on the server. The integration library has no standalone UX; serve its README instead. A sandbox networking failure does not establish that the host server is down; use the supported escalation when needed.
- The Windows browser needs an SSH tunnel. If it is not already connected, provide this Windows PowerShell command: `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:15174:127.0.0.1:5174 contabo-srive`. Tell the user to leave that terminal open.
- Present the tunnel command on one line in a code block and tell the user to paste the entire line before pressing Enter.
- The user confirmed this mapping works on 2026-09-06: Windows port 15174 forwards to server port 5174. Port 5173 serves an unrelated project, and binding Windows port 5174 returned Permission denied. Use the confirmed mapping by default in future sessions.
- If SSH reports `channel ... open failed: connect failed: Connection refused`, check and start the remote Vite server, then verify HTTP 200; the SSH connection itself is already established. Reuse an existing working tunnel.
- Return all four Windows browser links: `http://127.0.0.1:15174/admin/`, `http://127.0.0.1:15174/marketplace/`, `http://127.0.0.1:15174/onboarding/`, and `http://127.0.0.1:15174/integration/`. Distinguish verified server availability from client tunnel connectivity; a remote agent cannot establish the Windows-side tunnel without access to that machine. For an explicitly local preview, return the same four paths on the local server port.
- The root launcher owns one shared Vite instance. Explicit isolated checks require `npm run dev -- --isolated --port <test-port>` and use separate run-state directories. They must not overwrite the shared run record or touch the shared preview. All normal starts share `output/run-state/startup.lock` with the installed run helper. Never steal a stale lock or automatically terminate duplicate servers. Use the root launcher, not separate workspace servers, for normal previews.
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

### Standing test-wallet authorization

- The user authorizes agents to fund, onboard and use registered test wallets
  on Signet and Mutinynet whenever needed for testing, without asking for each
  faucet request or test transaction. This includes transfers between those
  test wallets and the local test faucet, and real contract lifecycle tests.
- Keep recovery phrases, private keys and signed recovery material protected.
  Preserve wallet data, transaction journals and exact network receipts.
- Reconcile existing pending operations before competing spends. This standing
  authorization does not turn an unknown outcome into verified failure or
  authorize fabricating a result. Apply the user's separately approved lost
  prototype-information policy only within its recorded sandbox scope.
- This grant does not cover mainnet, real-money purchases, unrelated wallets,
  production treasury changes, or importing/releasing the game dependency.

### Prototype sandbox integrity

Sandbox demos may use the same supplied test wallet for multiple roles. Distinct
wallets are not a prototype requirement. The standing test-wallet authorization
includes running the demos with the supplied Signet and Mutinynet test wallets.

The prototype sandbox SHALL remain simple in scope but real in implementation. A demo may expose a small, teachable flow, but it MUST use the real Arkade SDK and network-backed operations for the behavior it claims to demonstrate. It MUST NOT replace blockchain or contract behavior with browser-local state, fabricated transaction IDs, pseudocode presented as executable contract source, or wallet-to-wallet transfers presented as smart-contract execution. If a requested behavior cannot yet be implemented with the real SDK, the demo MUST say so clearly and remain explicitly marked as a sketch or unavailable rather than appearing complete.

Smart-contract demos MUST use a real compiled Arkade contract or covenant artifact, a real contract-derived address or output, real contract funding and spend paths, and verifiable contract state transitions. Tests MUST distinguish deterministic UI tests from live network verification; passing UI tests alone MUST NOT be reported as proof that the contract works on Arkade.

### Prototype demo source format

Every non-conditional-vault demo source shown in the prototype sandbox MUST
contain all executable code within exactly these three sections, in this order:

```ts
// Arrange

// Act

// Assert
```

The conditional-vault source is exempt from this formatting requirement.

Within `// Arrange`, keep setup in this order: imports first, a blank line,
`localStorageGetItem` reads next, another blank line, then the remaining setup
code. Demos without one of those categories should preserve the same spacing
between the categories that are present.
