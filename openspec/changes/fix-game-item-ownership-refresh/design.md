## Context

See proposal.md for motivation. Marketplace and the game run on different localhost ports, so browser storage is deliberately origin-scoped. The game already obtains an equipment controller through the public `@bis/integration` package and calls its refresh operation when Items opens; the package derives owned items from the active profile's asset read. The game currently vendors a specific local package archive, so fixes in BIS source are not automatically consumed by the game.

## Goals / Non-Goals

**Goals:**

- Preserve the existing public, Arkade-free equipment interface while making a post-checkout chain ownership read reliable for a matching profile in the separate game origin.
- Make package delivery a deliberate, auditable part of the fix and prove the full Marketplace-to-Items path with focused tests and browser evidence.
- Keep an unavailable ownership read safe: no item bonus, no invented ownership, and normal guest gameplay.

**Non-Goals:**

- Sharing IndexedDB, localStorage, sessions, recovery phrases, or browser credentials across ports.
- Adding a custom service, changing the Marketplace settlement sequence, or changing unrelated gameplay effects.
- Requiring an account for baseline gameplay.

## Decisions

### Keep chain ownership as the cross-origin source of truth

The game will use the explicitly restored player profile on its own origin and request fresh recognized equipment through the public package. This respects browser-origin isolation and prevents stale Marketplace UI state from being treated as ownership. Copying storage would be insecure, brittle, and contrary to the existing origin-local Account contract.

### Treat the game package snapshot as a deployable consumer dependency

After the BIS ownership-read behavior is corrected and tested, build a new package archive, replace the game's recorded vendor snapshot using its existing provenance/inventory process, and verify the game is running that exact package. Publishing BIS alone is insufficient because the game intentionally does not import sibling source.

### Test each boundary separately, then smoke the user journey

Unit coverage will construct a recognized delivered asset on a matching active profile and assert that the equipment controller exposes it only after a successful fresh read. The game test will exercise its Items refresh using the public package contract. The browser smoke will use the existing user-authorized local Player and Game Wallet sessions to confirm purchase completion, explicit game-origin profile access, Items visibility and selection, without recording recovery material.

## Risks / Trade-offs

- [Signet indexing or delivery has not settled when the game reads] → surface unavailable or empty ownership honestly, offer refresh/retry, and do not activate an effect until a successful fresh read.
- [The separately hosted game retains an older archive] → verify the installed package name, version/hash, and public API before browser acceptance.
- [A profile mismatch is mistaken for a missing item] → retain the visible account/profile context and test that only the exact restored profile receives the ownership result.
- [A local server serves stale built output] → rebuild and restart the affected local preview before the final browser check; release only after both demos run the verified assets.

## Migration Plan

1. Add the ownership-refresh regression tests and implement the smallest public-package correction in BIS.
2. Build and pack the integration package, update the game's vendored package through its established verification script, and run focused game tests.
3. Run the Marketplace purchase-to-game Items smoke test against the two local origins.
4. If user-visible validation fails, retain the prior vendored archive and report the observed pending or unavailable state; do not simulate ownership or copy browser data.
