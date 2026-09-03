# Project workflow

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
- Current slice: React split-screen demo, 9:16 preview, and an Account button opening a coming-soon dialog. No Arkade or wallet operations yet.
