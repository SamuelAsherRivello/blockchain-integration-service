# Lifecycle notification verification audit — 2026-10-11

**Follow-up:** the coordinator subsequently assigned the isolated production-host
browser run. It passed; see `verification.md` for its scope, results and source
boundary. The outstanding-evidence discussion below records the earlier audit
state and is superseded by that follow-up.

Coordinator assigned verification-only planning finalization. No product source,
task checkbox, game state, main spec or archive was changed by this audit.
The recorded checklist remains 6/6; that alone is not new browser evidence.

## Verified current behavior

- Read proposal, design, all six tasks, and the `bis-game-contract` delta.
- Current BIS `bis-facade.test.mjs` explicitly tests account connection and
  disconnection on the typed game channel, refresh neutrality with a reload
  spy, safe immutable projections, callback isolation and stable restart IDs.
  Fresh focused run: **21 passed, zero failures**.
- Current game `runtime/main.js` handles `accountConnected` and
  `accountDisconnected` through `handleAccountLifecycleChange`, coalesces
  callbacks, rebuilds the start menu when possible, and otherwise requests a
  browser reload once. Menu reconstruction uses current safe snapshot/capability
  state, rather than retaining the old Items creation-time state.
- Current game `runtime/integration/bis-account.js` handles logout's
  `restartRequested` with stable-ID deduplication and host-owned `restartGame`.
  Fresh `src/test/ui/bis-account.test.js` run: **11 passed, zero failures**,
  including logout restart, stale/disposed events and Player-only Items snapshot
  subscriptions. These tests use controlled fixtures, not actual user login.
- Read Release21 actual command records earlier in this cleanup: root BIS
  full tests and build exited 0, and game full tests/build exited 0. Those
  establish the supplied release baseline, not an exact browser lifecycle run.

Commands (from their respective repository roots):

```text
node --test BIS/packages/integration/tests/client/bis-facade.test.mjs
node --test stealth-steel/src/test/ui/bis-account.test.js
```

## Outstanding evidence and spec sync

Main `openspec/specs/bis-game-contract/spec.md` still has the older
`Safe state and notifications share one host channel` block: it does not yet
include the delta's explicit login/logout notifications, BIS refresh neutrality,
or game-owned location-dependent lifecycle recovery scenarios. The delta is
structurally suitable for an intelligent MODIFIED merge that preserves the
existing contract-funding and reset scenarios, but no merge was performed
before the full acceptance evidence gate was resolved.

The checked task 6 requires Playwright against the running game to verify
visible menu behavior and that BIS does not initiate browser refresh. No exact
historical browser record for this sequence was established by this audit.
The current 32 focused tests do not replace that requirement. Do not claim
that actual login/logout at the main menu and during gameplay was browser
verified from these tests or from an unrelated DPI/module-health check.

Coordinator currently owns game preview repair/cleanup and other chats own
live wallet acceptance. A new browser run was not started in parallel with
those owners. Required finalization handoff: identify matching existing
browser evidence or assign one coordinated acceptance run, then sync the
single MODIFIED contract block, validate and archive. Until then, retain this
change in the uncertain/evidence-review list despite its historical 6/6 count.
