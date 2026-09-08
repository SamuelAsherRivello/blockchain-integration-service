## 1. Implement the output convention

- [x] 1.1 Add the generated-artifact rule to root `AGENTS.md`, covering `output/<category>/<task>/`, folder creation, descriptive examples, and keeping temporary artifacts uncommitted; verify the diff preserves existing rules and excludes tracked assets and tool-managed build folders from relocation.

## 2. Relocate existing logs

- [x] 2.1 Recheck the scoped untracked root logs against the five groups in design.md, record source hashes and destinations without printing log contents, and verify all resolved paths stay within this workspace and no destination would be overwritten.
- [x] 2.2 Create the task folders under `output/logs/` and move the inventoried logs using literal paths, preserving filenames unless a collision requires a unique suffix; verify destination counts and hashes match the source inventory and report any files deferred because they are still being written.

## 3. Verify repository hygiene

- [x] 3.1 Verify `git status --short` no longer lists the migrated root logs and `git status --short --ignored -- output/` identifies ignored output; confirm the existing `/output` ignore rule remains effective and review the final diff for only the intended rule and planning changes.
