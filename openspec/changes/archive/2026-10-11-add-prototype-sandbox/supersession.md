# Superseded historical plan — archive decision, 2026-10-11

Disposition: archive **without syncing delta specs**. This is a historical-plan
closure, not a statement that the original literal Sandbox UX is the current
application contract. The original 7/7 checklist is retained unchanged.

The user asked this cleanup chat to process open changes sequentially through
the coordinator and list uncertain work separately. After reading the audit,
the coordinator explicitly selected superseded archival, with `--skip-specs`,
preserving the current owner's design and this decision evidence. See
`reconciliation-audit.md` for the original-versus-current requirement map.

Later user decisions are recorded in `Plan left navigation sidebar`
(`01a12bad-9e30-7d70-9d5b-37dc66a86f13`): the user references the actual
`/prototype-interactive-docs/` app and requests full-width header, a skinny
left column, vertical navigation, later Demos/conditional Variants headings,
50px main-content separation, 20px section spacing and neutral color changes.
The same chat records direct authorization to commit and push that scoped work.
Its current Home/first-visit handoff is `78fb9273`; related layout commits are
`48c77c9e`, `09931236`, and `74bc37e2`.

Current source is `BIS/packages/prototype-sandbox/`, package
`@spike/prototype-interactive-docs`, registered at `/prototype-interactive-docs/`.
The physical directory retains its historical name. Current source/tests cover
eleven named populated demos and separate Setup/Home behavior. The active
Interactive Docs owner remains responsible for that actual design.

Fresh cleanup verification:

`npm.cmd test --workspace @spike/prototype-interactive-docs`

Result: **7 passed, 0 failed**. Ignored diagnostic log:
`output/reports/openspec-backlog/sandbox-current-tests.log`.
Strict validation of the historical change passes structurally. These results
do not prove the obsolete `/prototype-sandbox/` routes or empty/horizontal UX.

No canonical `prototype-sandbox-navigation` spec is created. Its original ADDED
delta remains preserved in this archive for history only. No production source,
wallet data, server lifecycle or task checkbox was altered by this closure.
