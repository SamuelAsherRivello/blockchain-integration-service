## 1. Shared Account UI

- [x] 1.1 Remove the shared Account renderer's profile-chooser branch, Profiles action, chooser component import, and dedicated chooser presentation artifacts while leaving core multi-profile storage and public selection APIs intact; verify no Account UI route can render a saved-profile list, active marker, or Add Profile control.
- [x] 1.2 Route every no-active-account state, including one with retained saved identities, through the ordinary logged-out Account actions; verify Create Account, Restore Account, and Back remain available without identity enumeration.

## 2. Retained multi-profile behavior

- [x] 2.1 Preserve explicit core profile selection plus profile-scoped account, wallet, equipment, and operation isolation; update `profiles-context.test.mjs` to verify it without navigating through a production chooser.
- [x] 2.2 Preserve duplicate-safe creation and restoration and selected-profile-only logout cleanup; update the focused collection/browser tests and verify retained inactive identities are neither deleted nor automatically activated.

## 3. UI regression coverage and verification

- [x] 3.1 Replace the profile-chooser rendering test with assertions that active and logged-out Account markup contains no Profiles, Saved Profiles, Add Profile, active-marker, or saved-ID UI while Accounts Details retains its existing Account ID contract.
- [ ] 3.2 Run the focused integration profile/context/UI tests, `npm run typecheck`, `npm run build`, and `openspec validate hide-profile-chooser-ui --strict`; verify the produced Account UI in a browser host with retained local identities has no profile-management surface.
