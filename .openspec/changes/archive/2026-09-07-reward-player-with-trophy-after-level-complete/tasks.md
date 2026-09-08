## 1. Shared asset collection

- [x] 1.1 Add generic public asset-collection controller and focused tests for ownership, guest, fresh preflight, successful toast, duplicate/pending requests, account changes and bounded errors; preserve existing asset API tests.

## 2. Demo and game

- [x] 2.1 Add C6 Admin two-level completion preview with exact text/actions and shared collection behavior; verify guest, navigation, owned and in-place success/error states with isolated browser fixtures.
- [x] 2.2 Add packaged level catalog and tab-scoped progression; verify next-level/final detection, backup exclusion, reload and restart without wallet cleanup.
- [x] 2.3 Integrate the game completion menu, HUD snapshot and asset controller through the public BIS package; update death restart label while preserving paid revival; verify menu focus, locking and actions with focused tests.
- [x] 2.4 Build/pack BIS, install a fresh hash-named artifact in the game and record provenance; verify public exports and both production builds.
- [x] 2.5 With the user's explicit approval, make the empty Level02 template minimally playable using existing assets; verify its player, gold, exit and traversable route in tests and normal browser gameplay.

## 3. Acceptance

- [x] 3.1 Run focused BIS/game regression suites and real-browser verification of Admin and game completion, responsive/fullscreen behavior, progression, image toast and uncertain retry without live wallet mutations; record concrete evidence and limitations.
- [x] 3.2 Reconcile C6 documentation and affected game specifications with implementation, record verification results, and pass strict OpenSpec validation and whitespace checks. Do not claim live Signet issuance from fixtures.

