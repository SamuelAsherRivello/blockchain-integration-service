# BIS-to-game Account smoke test

This guide defines a concise cross-project acceptance pass for a game that consumes the BIS public integration package. The behavioral source of truth is the [game Account smoke-test specification](../../openspec/specs/game-account-smoke-test/spec.md); use this guide to organize a current run without copying dated package versions, ports, or release snapshots.

## Preconditions

1. Record the BIS and game revisions, working-tree status, browser, and browser origin used for the run.
2. Build and test BIS with its current root commands: `npm run typecheck`, `npm test`, and `npm run build`.
3. Build and test the consuming game with its own documented commands and the exact verified versioned BIS archive, hash, file inventory and source commit under test. Do not substitute a source symlink or declaration mirror for package acceptance.
4. Keep account storage origin-local. Do not copy browser storage, private keys, wallet databases or operation journals between the BIS demo and the game. Never reveal or export recovery phrases from an application. Separately authorized disposable test identities may be restored independently through production hidden recovery inputs using the agent's private encrypted vault; this is not permission to extract application secrets or transfer browser storage. Keep recovery entry out of screenshots, traces, videos, DOM dumps and logs.
5. Use a fresh isolated browser context for automated checks. Every AI-created game URL must include both `muteMusic=true&muteSFX=true`; never reuse a funded personal browser profile.

## Acceptance sequence

1. Verify guest gameplay remains available without an account.
2. Open the game’s Account entry point and confirm it mounts the production BIS experience through the public API rather than copied UI or private imports.
   The game consumes `IBis` and implements all five `IBisGame` methods. Check `stateChanged`/`accountClosed` delivery through `onBisEvent`, without context subscriptions, private DOM selectors or raw controller access.
3. Navigate into and back out of Account. Confirm focus returns to the game-owned entry point and game pause/input ownership is preserved.
4. Credential-free automation stops before wallet creation, funding, importing or financial submission. Separately, when explicitly authorized for a disposable test account, exercise create, reload, logout and restore. Handle recovery material privately; record only non-secret public identifiers and observed outcomes. Stable `restartRequested.logoutId` is deduplicated by the host.
5. Check narrow and ordinary desktop layouts, repeated open/close behavior, and host teardown. Confirm unavailable or slow initialization has a truthful return path.
6. Treat populated balances, transaction history, and financial mutations as separate evidence. Fixture coverage does not prove a live wallet outcome, and no smoke run should submit a financial operation merely to produce a passing report.

## Evidence and limits

Record commands, browser origin, observed UI behavior, package provenance, and any blocked step. Distinguish automated fixtures, empty-wallet observations, and live disposable-account checks. Do not claim a completed financial operation without direct evidence.

Offline lifecycle tests must cover stale/replaced sessions and hosts, duplicate operation IDs, rejected effects, asset-versus-sats payloads, unavailable-versus-empty snapshots and local reset/disposal. A financial confirmation is independent of `applied`, `already-applied` or `not-applicable` gameplay receipts. A failed effect does not authorize resubmission, and local cleanup does not cancel a remote transaction. Record these fixture results separately from browser and live checks.

Current remote preview and Windows tunnel guidance belongs in the root [README](../../README.md) and `AGENTS.md`. This guide deliberately avoids duplicating environment-specific commands that can drift.

## BIS-owned game runner seam

The private `test-wallets` runner registers the companion game as the exact
path `/blockchain-stealth-and-steel-game/` with the muted query
`?muteMusic=true&muteSFX=true`. The registry accepts the operator-selected
exact loopback origin, but it does not accept arbitrary paths, query strings,
or package versions. The public provenance record is `@bis/integration` 0.0.20
with SHA-256
`4de67c29df5ebdd25e8f47b30eac9c7ad5f0d602e3f4b94f57f18989672e6329`, as
documented by `stealth-steel/vendor/BIS_PROVENANCE.md` in the companion game.

This is a registration and validation prerequisite for owned acceptance. It
does not prove live game restoration, copy browser storage, export recovery
phrases, or initiate wallet operations; those remain explicit acceptance cases
in the test-wallet workflow.
