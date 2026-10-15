# Coordinated browser acceptance — 2026-10-11

Coordinator assigned the existing game preview at port 5175 and explicitly
accepted a synthetic public `IBis` event/snapshot fixture driving the unchanged
production game host. This verifies lifecycle integration, not live account
creation, identity authentication, funding or settlement. No wallet inputs,
payments, shared human browser state, product changes or new runtime hooks were
used. Browser contexts were fresh Edge profiles with both audio mute URL flags.

## Results

The retained runner is in the companion game repository:
`stealth-steel/src/test/browser/account-lifecycle.mjs`.
It replaces only the browser response for the public BIS module. Actual game
startup, `main.js`, `bis-account.js`, `bis-host-game.js` and start-menu UI execute
unchanged. The synthetic fixture owns no reload implementation.

Three independent browser contexts passed (connect, disconnect and stable-ID
logout restart). In each context:

- Guest menu had no Items button.
- A synthetic connection updated the safe snapshot/capability and disposed the
  old menu. Exactly one visible replacement menu contained enabled Items, with
  no Game Wallet capability.
- Disconnection removed Items, disposed the prior menu and left one replacement
  menu. Repeated stable-ID logout notifications caused no menu navigation.
- Clicking the actual Start button entered gameplay. Repeated lifecycle events
  then produced exactly one actual main-frame navigation. The three contexts
  separately covered connection, disconnection and logout restart.
- No browser page errors occurred.

Command from the game repository root:

```text
node stealth-steel/src/test/browser/account-lifecycle.mjs
```

Result JSON and six captured menu screenshots are under the game's ignored
`output/reports/notify-game-account-session/`. Connected/disconnected screenshots
were visually reviewed. Two initial test setup attempts did not provide
acceptance: `skipIntro=true` suppresses the menu being tested, so that query was
removed. The final run exited zero with all three contexts passing.

The earlier fresh BIS facade tests (21 passing) verify the real BIS event
producer, immutable safe projections, callback isolation and reload neutrality.
The fresh adapter tests (11 passing) verify deduplicated restart and disposed
event behavior. Those complement this public-boundary integration fixture;
the browser fixture alone does not exercise the real BIS event producer.
Existing successful release baseline full-suite/build records were audited in
`reconciliation-audit.md`; this scoped browser run did not duplicate full suites.

## Source boundary

Source SHA256 values observed immediately after the passing run:

| Companion game file | SHA256 |
| --- | --- |
| `stealth-steel/src/runtime/main.js` | `8DBE91466724E3CC3970972CD86584978C2C007B894040C124DB104CCE1931F5` |
| `stealth-steel/src/runtime/integration/bis-account.js` | `184A2064130988FC4608B89F38ADEF396B971FE6FDD2BBC882AA2C7E70603EF9` |
| `stealth-steel/src/runtime/integration/bis-host-game.js` | `81C06731CEDE89624A8183C49D7F3B14C4964E09BF81647CC8A316C2436667E9` |
| `stealth-steel/src/runtime/ui/start-game-prompt.js` | `6907DE1E307A715790AB0443BFCA7A9ED03F4793937392B70A4016BE5B3F7258` |

Concurrent viewport/layout patches belonged to the game cleanup owner and were
preserved. Coordinator confirmed that owner had stabilized the viewport source
and left account/host integration unchanged. Task checklist remains 6/6.

## Finalization

The browser evidence resolves the outstanding gate in the earlier audit. Sync
only the MODIFIED `Safe state and notifications share one host channel` block
into `bis-game-contract`, preserving the existing funding/reset scenarios,
Purpose and all other requirements. The change was validated and archived
without any claim of live wallet acceptance. `openspec validate --specs` passed
all 63 main specs, and strict change validation passed. The merged requirement
matches the archived delta after normalizing Windows/Unix line endings;
canonical main-spec structure is intact.
