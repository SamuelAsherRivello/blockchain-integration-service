# BIS-to-game Account smoke test

This guide defines a concise cross-project acceptance pass for a game that consumes the BIS public integration package. The behavioral source of truth is the [game Account smoke-test specification](../../openspec/specs/game-account-smoke-test/spec.md); use this guide to organize a current run without copying dated package versions, ports, or release snapshots.

## Preconditions

1. Record the BIS and game revisions, working-tree status, browser, and browser origin used for the run.
2. Build and test BIS with its current root commands: `npm run typecheck`, `npm test`, and `npm run build`.
3. Build and test the consuming game with its own documented commands and the exact public BIS package artifact or supported development integration under test.
4. Keep account storage origin-local. Do not copy browser storage, recovery phrases, private keys, or wallet data between the BIS demo and the game.

## Acceptance sequence

1. Verify guest gameplay remains available without an account.
2. Open the game’s Account entry point and confirm it mounts the production BIS experience through the public API rather than copied UI or private imports.
3. Navigate into and back out of Account. Confirm focus returns to the game-owned entry point and game pause/input ownership is preserved.
4. For a disposable test account only, exercise the documented create, reload, logout, and restore lifecycle. Handle recovery material privately; record only non-secret public identifiers and observed outcomes.
5. Check narrow and ordinary desktop layouts, repeated open/close behavior, and host teardown. Confirm unavailable or slow initialization has a truthful return path.
6. Treat populated balances, transaction history, and financial mutations as separate evidence. Fixture coverage does not prove a live wallet outcome, and no smoke run should submit a financial operation merely to produce a passing report.

## Evidence and limits

Record commands, browser origin, observed UI behavior, package provenance, and any blocked step. Distinguish automated fixtures, empty-wallet observations, and live disposable-account checks. Do not claim a completed financial operation without direct evidence.

Current remote preview and Windows tunnel guidance belongs in the root [README](../../README.md) and `AGENTS.md`. This guide deliberately avoids duplicating environment-specific commands that can drift.
