## Why

Seventeen untracked build and test logs currently clutter the repository root and Git's changes list. A documented output convention will keep temporary artifacts organized and out of commits.

## What Changes

- Add a repository-root `AGENTS.md` rule placing temporary generated artifacts under `output/<category>/<task>/`, creating subfolders before writing.
- Move the existing root `.bis-*.log` files into descriptive folders under `output/logs/`, preserving contents and filenames.
- Retain the existing `/output` Git ignore rule and verify it covers the moved files.
- Proposed category defaults are `logs`, `screenshots`, and `reports`; task folders describe the work producing them. These naming defaults are implementation recommendations.

## Capabilities

### New Capabilities

None. This is repository housekeeping and agent workflow documentation; `skip_specs: true` explicitly omits product spec changes.

### Modified Capabilities

None.

## Impact

Implementation affects `AGENTS.md` and local untracked logs. `.gitignore` already ignores `/output`, so no change is expected there. Runtime code, APIs, dependencies, standard build output directories, and tracked documentation assets are unaffected. No unresolved material scope decisions remain.
