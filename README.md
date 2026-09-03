<!-- AI may update existing content; add or remove content only when requested. -->

# Blockchain Integration Service

**WIP** — reusable BTC Lightning integration for browser games. The first React demo provides a split-screen admin and portrait runtime preview.

## Live Demo

[Open the live demo](https://samuelasherrivello.github.io/blockchain-integration-service/)

Current release: **v0.10.0**. Open the link without query parameters: the split-screen admin and 9:16 runtime preview appear. GitHub Actions runs plain `npm run build` and publishes `packages/integration-demo/dist`.

In the current local implementation, select Account / Account Button in Admin UI, then click the production Account button. Back returns to the button; Reset Client clears selection and runtime content. Create/Restore, payments, and achievements remain unavailable. The deployed release may lag the local checkout.

## Table of Contents

**Completed:** [A1. Open Account](documentation/User%20Story%20Diagrams.md#a1-open-the-game-then-account) ✅ — Account button → Account dialogue → Back.

1. [Live Demo](#live-demo)
2. [Getting Started](#getting-started)
3. [Project Overview](#project-overview)
4. [Project Details](#project-details)
5. [Troubleshooting](#troubleshooting)
6. [Resources](#resources)
7. [Credits](#credits)

## Getting Started

Read the [project brief](documentation/BGS_PROJECT_BRIEF.md) and [design discussion](documentation/design-discussion.md). With Node.js 24 or newer installed, run `npm ci`, then `npm run dev`. Open the printed localhost URL. The host HTML is `packages/integration-demo/index.html`; serve it through Vite rather than opening the source as a file URL.

### Release Workflow

1. Run `npm ci` and `npm run build` to check types and build both workspaces.
2. Commit and push to `main`; **Deploy live demo** builds the integration package and publishes `packages/integration-demo/dist/` through GitHub Actions.
3. Check the [workflow](https://github.com/SamuelAsherRivello/blockchain-integration-service/actions/workflows/deploy-pages.yml) and live site. Manual redeployment is also available.

### More Commands

| # | Name | Command | Comment |
| --- | --- | --- | --- |
| 1 | Changes | `openspec list` | List active changes. |
| 2 | Specs | `openspec list --specs` | List agreed specifications. |
| 3 | Setup | `./.openspec/setup.ps1` | Install all workflows locally. |
| 4 | Dev | `npm run dev` | Run the local React demo. |
| 5 | Build | `npm run build` | Check types and build both workspaces. |
| 6 | Preview | `npm run preview` | Serve the production demo locally. |

## Project Overview

Signet-only, Arkade-only integration with no custom application server. The separate game remains playable without an account. Real transaction outcomes only.

### Documentation

- [Brief](documentation/BGS_PROJECT_BRIEF.md): original BGS design baseline.
- [Design discussion](documentation/design-discussion.md): pending architecture and naming decisions.

### Configuration

React 19.2.8 + TypeScript, npm workspaces, and Vite. React was verified against the npm latest tag when this slice was created. The official Arkade SDK (`@arkade-os/sdk` 0.4.67) is installed in `packages/integration` but not initialized. No wallet or network operations run.

### Dependencies

| Package | Role | Version |
| --- | --- | --- |
| React + React DOM | Runtime UI | 19.2.8 |
| Arkade SDK | Future Signet adapter; currently unused | 0.4.67 |
| TypeScript | Type checking | 7.0.2 |
| Vite | Dev server and production builds | 8.2.2 |

The root `package.json` defines npm workspaces and shared tooling. Each package has its own manifest. `package-lock.json` locks the complete dependency tree; `npm ci` installs it locally. `.gitignore` excludes all `node_modules/` and `dist/` directories.

### Structure

- `packages/integration/src/`: public entry point, production UI, and reserved core/Arkade boundaries.
- `packages/integration-demo/src/`: admin panel, portrait preview, and split-screen composition.
- `documentation/`: brief and decisions.
- `.openspec/`: specification configuration.
- `.agents/skills/`: OpenSpec workflows.

The demo imports the integration package through its public exports. The runtime UI does not depend on the demo. On narrow screens, the admin and preview stack vertically.

## Project Details

### OpenSpec

All core and optional workflows from [OpenSpec profiles](https://openspec.dev/docs/profiles) are installed as Codex skills. Invoke with `$openspec-...`.

With OpenSpec CLI installed, run `./.openspec/setup.ps1` using PowerShell 7 after checkout. It creates an ignored local `openspec` compatibility link to `.openspec/`, because OpenSpec 1.11 expects the original directory name. Files are tracked only under `.openspec/`; the link is recreated on each machine. Run CLI commands from the repository root.

[Grill Me](.agents/skills/open-spec-grill-me/SKILL.md) is optional and user-invoked with `$open-spec-grill-me`. Use it before a proposal to clarify the idea, or afterward to refine planning artifacts. It is not a schema prerequisite and never starts implementation.

| # | Name | Skill | Comment |
| --- | --- | --- | --- |
| 1 | Explore | `$openspec-explore` | Discuss ideas. |
| 2 | Propose | `$openspec-propose` | Draft a change. |
| 3 | Apply | `$openspec-apply-change` | Implement agreed tasks. |
| 4 | Update | `$openspec-update-change` | Revise planning artifacts. |
| 5 | Sync | `$openspec-sync-specs` | Update main specs. |
| 6 | Archive | `$openspec-archive-change` | Archive completed work. |
| 7 | New | `$openspec-new-change` | Scaffold a change. |
| 8 | Continue | `$openspec-continue-change` | Create the next artifact. |
| 9 | Fast-forward | `$openspec-ff-change` | Generate planning artifacts. |
| 10 | Verify | `$openspec-verify-change` | Check implementation. |
| 11 | Bulk archive | `$openspec-bulk-archive-change` | Archive multiple changes. |
| 12 | Onboard | `$openspec-onboard` | Guided workflow. |

## Troubleshooting

If publishing fails, inspect the Actions run. Pages source must be **GitHub Actions**. The local Account demo supports the no-profile chooser; real account setup and the active-profile menu remain planned. If the local port is busy, use the URL printed by Vite.

## Resources

- [OpenSpec](https://openspec.dev/)
- [Source brief](documentation/BGS_PROJECT_BRIEF.md)

## Credits

### Created By

- Samuel Asher Rivello
- Over 25 years of game development experience as of 2026

### Contact

- Twitter: <https://twitter.com/srivello/>
- Git: <https://github.com/SamuelAsherRivello/>
- Resume and portfolio: <http://www.SamuelAsherRivello.com>
- LinkedIn: <https://Linkedin.com/in/SamuelAsherRivello>

### License

Provided as-is under the MIT License.
Copyright © 2026 Rivello Multimedia Consulting, LLC.



