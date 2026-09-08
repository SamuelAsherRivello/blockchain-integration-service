# Asset-preserving withdrawal release handoff

The Admin-first revision includes prompt registration acknowledgement, per-attempt Yes/Cancel warnings and independent reserved inputs. Existing unresolved live outcomes remain unverified.

## Tested build

- Package: `@bis/integration`, current manifest version `0.14.0`.
- Baseline HEAD: `e68f356b553d49c90d7888ebb9cd6a262d9a6ad3`, with uncommitted working-tree changes. Use the artifacts and hashes below to identify this tested build; HEAD and package version alone do not identify it.
- Build command: `npm run build` from the BIS repository root.
- `BIS/packages/integration/dist/integration.js` SHA256: `2A852E2392C888E79B87947D38F17A9D995FC1E55C7619D4D0643C23A0D5113C`.
- `BIS/packages/integration/dist/integration.css` SHA256: `F3FF10D341D76C06344239CE374B6777D8CFAA0B4805B1421F2D4338B6CBF1B3`.
- Acceptance: 270 integration tests, including asynchronous registration and multiple-transfer regressions, production build/typecheck, browser harness and both OpenSpec validations pass. Detailed scope and the previous full-suite stall are in `VERIFICATION.md`.

## Delivery steps still required

1. Select and record the intended release source revision, preserving unrelated work in the shared checkout. Rebuild and record replacement hashes if the release contents differ from this tested working tree. No version bump, tag, release or commit is implied by this handoff.
2. Scope the separate game-consumer update. The observed published game URL is `https://samuelasherrivello.github.io/stealth-and-steel-game/`; its currently loaded BIS build was not verified here. Inspect that repository's actual dependency/bundling and deployment workflow before choosing its update steps.
3. Update the game consumer with the selected BIS build, run that consumer's required checks and deploy within the separately authorized delivery scope. Verify the published build by its deployed revision/asset provenance, not only its unchanged package version or visible balance.
4. Record the final published URL and revision in this change's acceptance evidence before checking task 3.2.
5. On that build, read fresh operator fees/limits, eligible funds, assets and pending operations; obtain a review for the user's chosen amount. The user performs final financial confirmation. Confirm exact Bitcoin receipt and retained asset change, reload recovery and fresh Activity before marking live acceptance complete.

## BIS demo is a separate deployment

The checked-in `.github/workflows/deploy-pages.yml` runs on pushes to `main` and manual dispatch. It installs dependencies, builds and deploys `BIS/packages/integration-demo/dist` to GitHub Pages. It does not update or deploy the separate game and does not create tags or GitHub releases. Do not treat a successful BIS demo deployment as completion of the game-consumer task.

## Recovery constraints

Keep pending journals and account state intact through delivery. Never clear or replay an ambiguous withdrawal to make testing proceed. An old client may not verify the new asset-change metadata, so prefer a reviewed forward correction over downgrading an account with an unresolved asset-bearing withdrawal.

Status: local acceptance and handoff complete; published-game delivery and live financial acceptance not performed.
