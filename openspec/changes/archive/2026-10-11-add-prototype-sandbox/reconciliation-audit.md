# Historical plan reconciliation — 2026-10-11

Coordinator assigned verification-only safe finalization. No production files,
task checkboxes, or main specs changed. The original tracker remains 7/7.

This plan is **not suitable for literal synchronization into current main
specs**. It requires ten empty demos under `/prototype-sandbox/`, a horizontal
Navigation section and the exact `BIS - Prototype Faucet` title. Current
`BIS/scripts/dev-config.mjs` registers `/prototype-interactive-docs/`; package
metadata names `@spike/prototype-interactive-docs`; current navigation tests
assert eleven named demos plus separate Setup and Home flows. The package
directory retains its old `prototype-sandbox` name.

Read the actual `Plan left navigation sidebar` chat
(`01a12bad-9e30-7d70-9d5b-37dc66a86f13`), including the user's explicit request
for a full-width title bar, skinny left column and vertical navigation. Later
user requests specify left-aligned main content, Demos/conditional Variants,
and styling refinements, followed by explicit commit/push authorization.
Owner records include `48c77c9e`, `09931236`, and `74bc37e2`. The latest owner
handoff reports Home/first-visit behavior with seven passing package tests,
build and browser verification in `78fb9273`. These are later explicit
decisions; reverting to an empty horizontal shell would contradict them.

The first commit that tracks the old plan, `99b6c2b0`, already names the package
Interactive Docs. Thus its seven checked boxes are historical completion
claims, not a verified current-route contract. No main
`prototype-sandbox-navigation/spec.md` currently exists. Creating it from the
old delta would publish obsolete route/title/empty-body requirements.

Strict validation of the old change passes; that is structural validation,
not proof its original behavior remains current. Fresh current-package
deterministic tests are recorded in
`output/reports/openspec-backlog/sandbox-current-tests.log`. They verify the
current Interactive Docs contract, not the obsolete Sandbox contract.

Initial audit disposition: place this change in the user's second list as
superseded/needs planning reconciliation, despite zero unchecked tasks.
After receiving this audit, the coordinator explicitly selected historical
superseded archival without syncing obsolete requirements. See
`supersession.md` for that decision and its exact evidence. The application's
current UI remains unchanged.
