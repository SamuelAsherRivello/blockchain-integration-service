# Proposal

## Why

BIS copy actions already have a useful checked-control pattern, but several renderers still add redundant success text such as “Account ID copied.”, “Recovery details copied.”, or “Copied to clipboard.” Some custom copy buttons do not use the checked pattern at all. The BIS UI should have one consistent success indication across every copy action while retaining useful failure guidance.

## What Changes

- Standardize every BIS copy action on the checked copy-control success pattern.
- Remove successful-copy status text, including visible and screen-reader-only messages such as “<field> copied.”, “Recovery details copied.”, and “Copied to clipboard.”
- Cover shared value fields, copyable text areas, item-list exports, transaction and asset reports, recovery phrase copying, pending-operation messages, custom recovery-detail copying, and the standalone onboarding spike’s copy controls.
- Preserve clipboard-failure messaging, selectable/manual-copy fallback, async stale-result protection, and copied data exactly.
- Update focused renderer tests and acceptance checks for every copy-button category, including success, failure, retry, disabled, and stale async behavior.

## Capabilities

### New Capabilities

- `bis-copy-feedback`: Defines the shared BIS copy interaction across value fields, reports, exports, and recovery controls, including checked-control success feedback and failure fallback without redundant success-status text.

### Modified Capabilities

- None.

## Impact

- Affected implementation: shared copy controls and all BIS copy consumers under `BIS/packages/integration/src/client/ui-layer-react/`, plus their Admin host fixtures.
- Affected consumers: Account ID, balances, addresses, transaction and asset lists/details, recovery phrase, recovery reports, pending-operation messages, custom recovery actions, and standalone onboarding recovery/address copies.
- No public data, clipboard payload, wallet, or provider API changes are intended; this is a UI feedback and control-consistency change.
- Verification should cover every copy-button category and confirm no success-status text remains anywhere in BIS copy flows.
