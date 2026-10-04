## Context

See proposal.md for scope. Game main.js loads Level01 unconditionally; Level01 and Level02 are packaged. The existing Tiny Swords win menu reloads, while concurrent B2 work adds paid revival and an independent restart button. Gold HUD exposes collected and derives its total from placed pickups. BIS already has durable request IDs, mint/list APIs, shared wallet locks, and D1 image toasts. Preserve concurrent work in both checkouts.

## Goals / Non-Goals

Share generic collection safety between hosts without moving trophy identity or game progression into BIS. Keep the game menu styled by the game and the demo menu styled by the demo. No issuer trust enforcement, new wallet, automatic funding, gold accounting change, or live mint during automated acceptance.

## Decisions

1. Export a generic createBisAssetCollection controller with caller-provided mint metadata and success message. Match positive holdings by exact name/ticker/decimals, ignoring icon URL. This is a demo matching rule, not trusted provenance. Both hosts supply the level preset. Use existing generic mint/list APIs; do not alter independent-operation reservation policy.
2. State is checking, available, owned, guest, pending, uncertain, blocked or error. Read ownership and pending request before enabling mint, repeat the read before submission, bind the operation to its profile, and reuse a matching pending request for explicit Check Trophy Status. An unrelated pending mint blocks new collection without taking over that operation. Disable all menu actions during the bounded collection call, then restore navigation. Account changes/disposal invalidate late output and success toasts. Generic API deadlines bound real calls; a controller deadline fails closed for unresponsive hosts. Retain a request after any ambiguous response; mint journals are never cleared by menu navigation.
3. Definitive failures show an acknowledgment inside the retained menu; uncertain outcomes show inline Check Trophy Status. Ownership-read failures offer read retry. Success shows Level N Trophy collected! and the result image, once per completed interaction. Fresh holding reads determine later eligibility; no permanent achievement ledger is introduced.
4. Build the game catalog from exact LevelNN.tmj filenames in Vite configuration and inject a sorted list. Require contiguous levels starting at 1. At completion inspect the catalog for N+1; loading errors remain errors, not Game Completed. Keep current level and completed count in tab sessionStorage; Continue updates before reload, Restart resets only this key to Level 1. Reload restarts the selected level; collected gold resets normally. Throw a usable error if progression storage cannot be written rather than claiming to advance.
5. Extend the existing game menu with a snapshot of HUD gold at exit. N is completed levels in this run, L is packaged catalog length. Loss keeps B2 pay controls and changes only restart labeling/handler. Completion menus retain pause/input ownership and cannot be dismissed by backdrop/Escape.
6. Admin C6 displays a two-level sample with HUD-like numbers, using the same collection controller and existing presets. Continue changes the sample to final completion; Restart closes the simulation. Only game events are synthetic; default wallet APIs are real. A private fixture can inject isolated context for acceptance.
7. Reuse the game BIS host's cached context and passive toast surface; add an asset-collection factory without exposing private imports. Refresh the version/hash-named tarball after building BIS and verify provenance. Game metadata stays host-owned. Levels beyond configured trophy art remain playable with collection unavailable.
8. The existing Level02 template had no player or goal. The user approved minimal map authoring to complete the two-level flow: reuse the existing grass terrain and spawner palette, place one player, three gold pickups along a clear route and one exit. No new artwork or enemy mechanics. Verify both normalized map content and ordinary browser movement through the pickups to the exit.
9. Per the user's presentation correction, do not add separate text boxes to menus. Completion status belongs in the existing body. When owned, append exactly `You already own this trophy.` and omit the former `Already collected` label and separate status element in both game and Admin.

## Risks / Trade-offs

- Metadata can be copied by anyone: accepted demo limitation, X1 provides future issuer design.
- Reload during submitted work: preserve BIS recovery records and reconcile before reissuing.
- Concurrent changes: re-read overlapping files before patching, preserve B2 and D1 behavior, run their focused regressions.
- Network/map failures: distinguish packaged existence from fetch availability; never misreport victory or mint success.

## Migration Plan

Additive API and UI changes only. Build and pack BIS, copy a new hash-named archive into game vendor, update its local package reference without removing old archives. Validate both builds and focused tests, then verify real browser flows with isolated wallet fixtures. No deployment, commit or live wallet mutation is required. Record any unperformed live check explicitly.
