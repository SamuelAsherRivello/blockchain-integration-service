# Verification

- Implemented shared AccountCard version metadata import and independently anchored, 30% opacity version label. All existing production Network: Signet headers use this shared component.
- Current package version at implementation is 0.14.1 (advanced from the proposal's observed 0.14.0). No version bump was made for this change.
- `npm run build` passed, including typecheck, integration library and demo. Initial sandbox spawn EPERM was resolved by running the authorized build outside the sandbox. Vite reports a non-blocking large-chunk warning.
- Browser fixture `/tests/form-header.html` passed for logged-out and active source UI at host widths 360, 280 and 240px, current and longer version labels, network center within 1px, no overlap/overflow, 30% fade, lowercase v and sticky scrolling behavior. Screenshot inspected visually.
- `/tests/form-header.html?built` passed the same geometry/style checks for logged-out built-library UI using its own public context. Source-internal fixture contexts cannot be passed to the built library because its internal context registry is separate.
- Existing details-layout header selector now checks the dedicated network span and package version. Its route did not require adjustment: openAccountDetails still selects Balance. That broader balance fixture was not rerun; the dedicated header fixture covers this change.
- OpenSpec strict validation passed. No live wallet operation was performed.

Follow-up (2026-09-08): Lowered the version label using top: 50% and translateY(-50%) within the network anchor. Browser inspection of Account at 50% preview scale measured label centers within 0.61 screen pixels. Network horizontal positioning is unchanged. This follow-up is verified in the BIS development preview; the earlier game package has not been repacked for this CSS change.
