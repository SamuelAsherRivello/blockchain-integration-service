# Tasks

## 1. Scope the game settings reset

- [x] 1.1 Update `stealth-steel/src/runtime/ui/settings-ui.js` so Clear Settings uses only the injected game settings store, does not obtain or reset BIS, and reports only the game-settings result; verify a static review finds no BIS reset call in the handler.
- [x] 1.2 Remove the now-unused Clear Settings BIS-reset callback and facade access from the game settings UI contract and its call sites; verify the game test suite has no stale Clear Settings reset mocks or callback wiring.
- [x] 1.3 Update the game's current reset documentation and OpenSpec contract to state that Clear Settings resets game-owned state only; verify it does not describe Clear Settings as a BIS reset trigger.

## 2. Prove storage ownership

- [ ] 2.1 Add settings-store coverage that confirms reset removes only the game-owned settings record and restores in-memory defaults; verify the focused runtime-settings tests pass.
- [ ] 2.2 Replace the Clear Settings BIS-reset UI test with coverage that seeds non-game same-origin records and proves the button does not call a BIS facade or alter those records; verify the focused settings UI tests pass.
- [ ] 2.3 Run the game's relevant test command and production build, then record the results in the change evidence without storing secrets.
