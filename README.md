<!-- AI may update existing content; add or remove content only when requested. -->

# Blockchain Integration Service

**WIP** — reusable BTC Lightning integration for browser games. Architecture and naming are being refined before implementation.

## Live Demo

[View the WIP site](https://samuelasherrivello.github.io/blockchain-integration-service/)

Planning placeholder only; wallet, payment, and achievement features are not implemented.

## Table of Contents

1. [Live Demo](#live-demo)
2. [Getting Started](#getting-started)
3. [Project Overview](#project-overview)
4. [Project Details](#project-details)
5. [Troubleshooting](#troubleshooting)
6. [Resources](#resources)
7. [Credits](#credits)

## Getting Started

Read the [project brief](BGS_PROJECT_BRIEF.md) and [design discussion](docs/design-discussion.md). Open `site/index.html` to preview the WIP page. No application dependencies are installed yet.

### Release Workflow

1. Review the documentation and WIP page.
2. Commit and push to `main`; **Deploy live demo** publishes `site/` through GitHub Actions.
3. Check the [workflow](https://github.com/SamuelAsherRivello/blockchain-integration-service/actions/workflows/deploy-pages.yml) and live site. Manual redeployment is also available.

### More Commands

| # | Name | Command | Comment |
| --- | --- | --- | --- |
| 1 | Changes | `openspec list` | List active changes. |
| 2 | Specs | `openspec list --specs` | List agreed specifications. |
| 3 | Setup | `./scripts/setup-openspec.ps1` | Install all workflows locally. |

## Project Overview

Signet-only, Arkade-only integration with no custom application server. The separate game remains playable without an account. Real transaction outcomes only.

### Documentation

- [Brief](BGS_PROJECT_BRIEF.md): original BGS design baseline.
- [Design discussion](docs/design-discussion.md): pending architecture and naming decisions.

### Configuration

Planned: React + TypeScript. Application tooling and package boundaries remain WIP.

### Structure

`openspec/` holds specification configuration, `.agents/skills/` holds OpenSpec workflows, and `site/` holds the temporary Pages site. Application structure is undecided.

## Project Details

### OpenSpec

All core and optional workflows from [OpenSpec profiles](https://openspec.dev/docs/profiles) are installed as Codex skills. Invoke with `$openspec-...`.

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

If publishing fails, inspect the Actions run. Pages source must be **GitHub Actions**. Wallet and game controls are not available during this planning phase.

## Resources

- [OpenSpec](https://openspec.dev/)
- [Source brief](BGS_PROJECT_BRIEF.md)

## Credits

### Created By

[Samuel Asher Rivello](https://github.com/SamuelAsherRivello)

### Contact

[Portfolio](https://www.SamuelAsherRivello.com)

