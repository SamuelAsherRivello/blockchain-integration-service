## 1. BIS contract

- [x] 1.1 Implement the public fixed-price continuation controller over B1 and D7; test duplicate clicks, pending/read failure, definitive failure/retry, exact success toast, account changes and disposal without real payments.
- [x] 1.2 Use the controller for Admin B1 with the exact quoted label `"Pay 1000 Sats To Coninue"`; verify confirmed success produces the toast inside Runtime Preview without duplicate payment.

## 2. Game integration

- [x] 2.1 Add a persistent passive BIS mount and public continuation access while preserving Account modal lifecycle; verify Account host regression tests and toast visibility outside Account.
- [x] 2.2 Implement the ordered loss actions and pending/failure/login presentation using BIS's price, a left lightning icon, and shared menu text fitting that accounts for icon width; test disabled actions, retry, teardown and matching callbacks and browser-verify narrow labels.
- [x] 2.3 Rebuild the defeated player through the reusable row/column spawn function also used at level start, preserve position/loadout, add the guarded loss-to-playing transition and instantly remove enemies from the centered 3x3 cells before resuming; test full health, visible rendering, input after respawn, diagonals, distance and repeated deaths/callbacks.

## 3. Delivery

- [x] 3.4 Include the requested left lightning logo on confirmed-payment toasts; rebuild the shared package and verify its position in both game and Admin preview.
- [x] 3.1 Build and package BIS and update the game's exact vendor snapshot; verify both production builds and related regression suites. The unrelated concurrent map checksum failure is recorded in verification.md.
- [x] 3.2 Verify real-browser game presentation and the public callback integration using isolated payment fixtures; record fixture versus live evidence, logged-out state, success, failure, pending and teardown outcomes.
- [x] 3.3 Update B2/API documentation and game state/loss specs, record verification evidence, and pass strict OpenSpec validation and scoped whitespace checks. Unrelated shared-worktree whitespace findings are recorded in verification.md.
