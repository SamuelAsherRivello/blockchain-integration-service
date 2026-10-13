# Tasks

## 1. Public lifecycle bridge

- [x] 1.1 Define and export the versioned, public-only Player/Game wallet lifecycle notification types and publisher/listener API from `@bis/integration`; verify the package typecheck exposes no recovery phrase, private key, signing object, balance, or transaction payload field.
- [x] 1.2 Implement trusted browser-peer validation for origin, source window, notification schema, and per-role monotonic revision; verify unit tests reject malformed, replayed, stale, untrusted-origin, and unexpected-source messages without publishing a state change.
- [x] 1.3 Add publisher integration points for Player and Game Wallet activation/deactivation, including intentional business-window close; verify focused tests emit exactly one valid public notification for each lifecycle transition.

## 2. Marketplace lifecycle policy

- [x] 2.1 Add Marketplace observed-wallet projections and bridge configuration without changing its existing local context/controller authority; verify an accepted login can update a label while Buy, Sell, listing, and checkout remain gated by local eligibility.
- [x] 2.2 Fence Marketplace inventory, item snapshots, display labels, and checkout work with local plus observed wallet revisions; verify late Player or Game inventory results cannot repopulate a deactivated session.
- [x] 2.3 Apply accepted Player logout by clearing Player and dependent Game active presentation and checkout state, and apply accepted Game logout by retaining Player-only state while clearing Game state; verify each role's required actions become unavailable immediately.

## 3. Verification and integration handoff

- [x] 3.1 Add Marketplace and integration tests covering trusted Player login/logout and Game login/logout notifications, stale/replayed notifications, and a logout during a pending checkout; verify the focused test suites pass.
- [x] 3.2 Document the required trusted Marketplace peer registration and business lifecycle publication contract for the separately maintained game/business application; verify the documentation contains only public identity/network/address information.
- [x] 3.3 Run the repository's relevant typecheck, Marketplace tests, integration tests, production builds, and TypeScript migration check; verify all pass and no generated test artifacts are committed. The repository exposes no `lint` script, so `npm run` was used to confirm that absence rather than treating it as a passing lint gate.
