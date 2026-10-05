# Reward Player With Trophy After Level Complete

## Why

Players need an optional trophy reward at each level exit without leaving the completion menu. C6 connects game progression and the existing self-funded Signet mint/list APIs; X1 game-controlled issuance remains separate.

## What Changes

- Add C6 under Assets in both the game integration and BIS Admin Runtime Preview.
- Show Level Completed when the next packaged LevelNN.tmj exists, otherwise Game Completed. Use the agreed gold summary and final N/L levels text; gold matches the existing HUD.
- Offer Collect Level N Trophy, Continue To Next Level, Restart Game in that order; omit Continue on Game Completed. Rename the death restart button to Restart Game while preserving paid revival.
- Recognize current positive holdings matching the level preset name, ticker and decimals, including older Admin trophies regardless of icon version. After burning/transferring away a trophy, a subsequent completion can mint another.
- Disable collection without an account, while ownership is unknown, when already owned, or without configured trophy metadata. Keep progression independent of rewards.
- Explicit collection uses the active player's funds. Retain the completion menu and disable all its actions during the bounded attempt. Confirmed success greys collection and shows Level N Trophy collected! with the awarded image through D1. Errors never fabricate success; uncertain operations reconcile the same request.
- Add real next-level navigation, tab-scoped run progress, Level 1 restart and a build-derived level catalog excluding backup files.
- Make the existing empty Level02 template minimally playable using existing terrain, player/goal markers and three gold pickups, as explicitly approved during implementation.

## Capabilities

### New Capabilities
- `level-complete-trophy-reward`: Completion presentation, progression, optional host-defined asset collection and safe in-place outcome handling.

### Modified Capabilities
- `story-driven-demo`: Add C6 with a two-level completion simulation and explicit real-wallet mint calls.

## Impact

BIS adds a generic asset-collection controller using existing public mint/list APIs and D1 toasts; host-provided metadata/matching retain game rules outside BIS. Demo owns its completion presentation. The game consumes a refreshed pinned BIS package, extends its existing Tiny Swords completion menu, and integrates progression into main.js. No new dependencies, servers, automatic funds movement, gold-accounting redesign, X1 wallet or C5 sats rewards. Planning is centralized in this BIS change; both named repositories are implementation targets.

## Confirmed decisions and implementation defaults

The interview confirmed Admin trophies count, current ownership permits re-collection, guests cannot collect, next-level existence selects the prompt, final completion has Trophy/Restart only, HUD gold parity, final N/L text, action locking while minting, and both Admin/game delivery. Implementation defaults from the approved plan: match name/ticker/zero decimals; use v2 presets; sessionStorage for run progress; exact packaged level catalog; inline Check Trophy Status for uncertainty; acknowledgment for definitive failures. Missing metadata keeps progression usable. No unresolved product decision remains. Live Signet mutation verification is separately authorized, not automatic.
