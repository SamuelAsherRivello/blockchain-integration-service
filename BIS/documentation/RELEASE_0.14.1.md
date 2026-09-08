# BIS 0.14.1 local game package

Date: 2026-09-08

Packaged the current BIS working tree and installed it into the local Stealth & Steel game. This is a local package delivery; no GitHub release or npm registry publication was performed.

Includes the existing report scrollbar replacement and current Activity, transfer recovery, and boarding fixes. Uncommitted source changes were included; this artifact is not a clean tagged commit.

Artifact: `bis-integration-0.14.1-df8a5489fc1d.tgz`
SHA-256: `df8a5489fc1dabb577ab2f3558f362a74c4b4aa5b0724e03e4e10f25dbaabdb1`
Game dependency: `file:STEALTH_STEEL/vendor/bis-integration-0.14.1-df8a5489fc1d.tgz`

Validation: BIS typecheck and library/demo builds passed. All 279 BIS tests passed using `node --test --test-force-exit` because Vite fixtures retained open handles. All 958 game tests and 7 publication checks passed; game production build passed. React/React DOM 19.2.8 resolve as one shared instance. Browser verification at http://127.0.0.1:5173/ reached Settings > Account. The server returned HTTP 200 for the installed ReportTextArea module containing bis-report-scrollable. No wallet creation or financial operations were performed.

Rollback: the prior `bis-integration-0.14.0-31b999e50909.tgz` remains in the game vendor directory. Reinstall that package with npm to return to the previous snapshot.
