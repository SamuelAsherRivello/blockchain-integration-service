## Context

See proposal.md for motivation. The root `.gitignore` already contains `/output`; `AGENTS.md` has no general generated-artifact rule. Current root logs belong to five task groups. No references to those log names were found in the searched non-log project files. This design records the migration mapping and collision handling before files move.

## Goals / Non-Goals

**Goals:** Preserve existing diagnostic evidence and make future temporary output placement predictable.

**Non-Goals:** Reconfigure tool-managed `dist/`, relocate tracked assets or planning documents, introduce cleanup automation, or change application behavior.

## Decisions

- Use repository-root `output/<category>/<task>/` for agent-generated temporary logs, screenshots, reports, and diagnostic dumps. Category-first organization makes artifacts easy to find. Keep existing tool-specific output conventions such as `output/playwright/` valid; do not migrate unrelated output.
- Add the convention directly to root `AGENTS.md`, including creating destination folders before writing, keeping temporary output out of the repository root, and never committing it. A broad `*.log` ignore alone would hide the symptom without organizing files.
- Preserve `/output` in `.gitignore`; no new ignore pattern is necessary.
- Preserve each existing filename and map prefixes as follows:

| Root prefix | Destination folder | Observed count |
| --- | --- | --- |
| `.bis-f2-` | `output/logs/f2/` | 4 |
| `.bis-independent-` | `output/logs/independent/` | 6 |
| `.bis-release-` | `output/logs/release/` | 2 |
| `.bis-wallet-single-refresh-` | `output/logs/wallet-single-refresh/` | 2 |
| `.bis-wallet-subscription-` | `output/logs/wallet-subscription/` | 3 |

## Risks / Trade-offs

- Destination collision -> Check before moving; retain both files with a unique suffix rather than overwrite.
- Concurrent log writers -> Recheck the inventory at apply time; defer any file still being written and report it.
- Accidental movement of unrelated files -> Move only confirmed untracked root logs matching the listed groups, using literal paths verified inside this workspace.
- Ignored output is local evidence only -> Keep durable documentation and OpenSpec artifacts in their tracked locations; do not treat ignored folders as secret storage.

## Migration Plan

During implementation, add the rule, inventory and hash the scoped logs, create destinations, and move each file without overwriting. Verify hashes and file counts after moving, then verify generated logs no longer appear in Git status. Use status with ignored files included to confirm the destination is ignored. No application tests are needed for documentation and file relocation. If reversal is needed, move the files back only after checking for collisions; no destructive Git operation is involved.
