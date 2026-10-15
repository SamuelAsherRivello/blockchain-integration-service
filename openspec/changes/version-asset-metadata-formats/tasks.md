# Tasks

## 1. Asset-format contract and metadata transport

- [x] 1.1 Add provider-neutral asset-format types, `0.0.1` registry entry, safe resolver results, and public exports; verify focused integration type/unit tests cover explicit, unmarked-compatible, generic, unknown, and malformed holdings.
- [x] 1.2 Stamp `bisAssetFormatVersion: "0.0.1"` on every BIS-managed issuance without changing current metadata payload encoding; verify mint request and Arkade adapter fixtures preserve `bisAttributeDeltas` and all existing values.
- [x] 1.3 Route generic wallet/public inventory listings through format resolution while retaining every positive generic holding; verify list tests assert no format result hides an asset or exposes SDK/raw decode data.
- [x] 1.4 Move marketplace/trophy/item validation and catalog metadata construction behind the registered format contract; verify existing `0.0.1` catalog fixtures and adversarial metadata tests pass.

## 2. Latest-only consumer behavior

- [x] 2.1 Gate game-facing item selection, equipment classification, and runtime effects on the latest resolved format; verify older, unknown, malformed, and non-BIS assets cannot provide gameplay effects.
- [x] 2.2 Gate Marketplace inventory, cards, details, checkout, and catalog verification on the latest resolved format; verify current items render normally and earlier/unsupported holdings produce truthful migration/unsupported states.
- [x] 2.3 Preserve cache ownership and invalidate inventory after resolved format mutations; verify role/profile/network cache tests cover replacement delivery, retirement, and stale-result suppression.

## 3. Admin version selection and version-scoped operations

- [x] 3.1 Add a supported-version selector to each Admin asset-listing/operation surface, defaulting to the latest and retaining an unsupported diagnostic view; verify selection changes do not hide generic ownership or cross account/network scope.
- [x] 3.2 Route Admin Asset detail operations and C.G.2/C.G.3/C.G.4 catalog mint/list/verify/burn paths through the selected registry handler; verify a selected mismatch blocks mutation and the current selection preserves existing `0.0.1` behavior.
- [x] 3.3 Add safe Admin Console/UI reporting for resolved version, selected version, unsupported format, migration eligibility, and recovery state; verify no secrets, raw SDK errors, or false success appear in UI fixtures.

## 4. Durable automatic migration

- [x] 4.1 Define version successor declarations with deterministic per-item mapping and `autoUpgrade` defaulting true; verify a successor cannot register without an explicit compatible-predecessor mapping or opt-out decision.
- [x] 4.2 Implement durable per-holding migration records and reconciliation keyed by source asset/version, target version, owner, network, and operation identity; verify duplicate calls and reloads reuse the original migration rather than minting another replacement.
- [x] 4.3 Implement the active-Game-Wallet mint/deliver, fresh Player Wallet ownership verification, then guarded old-holding retirement sequence using existing mint/delivery/burn protections; verify one exact replacement per player holding, network/account guards, reservation behavior, and no old-item loss on failure.
- [x] 4.4 Add Admin's explicit Upgrade all player items action to find every eligible holding of the logged-in Player Wallet, start/resume migrations independently, and continue after safe disjoint item failures; verify browsing never triggers migration and unavailable player/Game Wallet/funding scope causes no mutation.
- [x] 4.5 Add a `0.0.2`-from-`0.0.1` test-only format fixture covering full player-batch completion, per-item unavailable/unknown continuation, explicit opt-out, interruption after delivery, uncertain retirement, account/network change, and recovery; verify one replacement maximum and truthful old-item state in each case.

## 5. Verification and documentation

- [x] 5.1 Update integration, Admin, and Marketplace documentation to explain the `0.0.1` marker, future-format registration, automatic-upgrade default, explicit opt-out, and immutable-asset replacement behavior; verify package documentation links resolve.
- [x] 5.2 Run focused asset/version/migration tests, package typechecks, and production builds; verify failures are classified as implementation or environment-specific without recording secrets.
- [x] 5.3 Run the applicable full test suite and browser acceptance for Admin version selection, Marketplace latest-only inventory, and upgrade state; store generated reports only under ignored `output/` paths and verify they contain no secrets.
- [x] 5.4 Before any live successor migration, inspect and report public selected wallet/network/holdings, require the active authorized scope, and record only public migration evidence under `output/`; verify no live mutation runs from stale or unverified inventory.
