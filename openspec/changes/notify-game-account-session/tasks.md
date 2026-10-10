# Tasks

- [x] 1. Confirm the BIS event contract and add regression coverage proving account connection/disconnection and logout restart notifications remain safe, typed, deduplicated, and browser-refresh-neutral.
- [x] 2. Update the Stealth & Steel game BIS adapter to treat account lifecycle events as snapshot invalidations and to preserve logout restart idempotency.
- [x] 3. Refactor game-owned start-menu construction so it can be disposed and rebuilt from the latest BIS snapshot, including correct Items visibility and enabled state.
- [x] 4. Make the game choose recovery behavior: rebuild the menu at the main-menu boundary and refresh the browser when account changes occur during gameplay or another non-menu view.
- [x] 5. Add/update game unit and browser tests covering login, logout, menu reconstruction, and refresh ownership; update current integration documentation.
- [x] 6. Run BIS typecheck/tests and the game test suite, then use Playwright against the running game to verify the visible menu behavior and that BIS does not initiate the refresh.
