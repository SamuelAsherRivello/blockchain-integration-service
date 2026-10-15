# Proposal

## Why

BIS currently expresses the same label/value interaction through several components and hand-built markup, including copyable inputs, report text areas, balance displays, address displays, and review summaries. This makes equivalent fields look and behave differently across account, admin, and marketplace views and makes future UI changes expensive to apply consistently.

The component vocabulary should distinguish reusable form/value primitives from screen-level views while preserving the existing behavior and data contracts.

## What Changes

- **BREAKING** Rename `CopyableValueField` to `FormValue` and make copying an opt-in `copyable` prop.
- Consolidate `CopyableTextArea` and `ReportTextArea` into `FormValue` using a `multiline` prop.
- Move copy-button, clipboard, disabled, selection, and failure-feedback behavior into `FormValue`.
- Rename `CopyFieldLabel` to an internal implementation detail of `FormValue`.
- Rename `FieldHeading` to `FormHeading` and `BalanceTooltip` to `FormTooltip`.
- Rename `ReviewDetails` to `FormValueList` for repeated label/value summaries.
- Add domain wrappers named `AccountBalancesFormValue`, `AccountAddressesFormValue`, and `AccountIdentityFormValue`.
- Rename screen-level components with domain-first `View` names, including `AccountActivityView`, `AccountAssetsView`, `AccountOnboardingView`, `AccountSendView`, `AccountTransferView`, `GameWalletLoginView`, and related collection/admin views.
- Replace equivalent inline value, balance, address, price, metadata, and report markup with the shared components.
- Preserve copied payloads, accessibility labels, loading and failure behavior, storage, wallet operations, and public runtime APIs except for the explicitly renamed UI component exports.

## Capabilities

### New Capabilities

None. This is a component consolidation and naming refactor with no new durable user-facing capability.

### Modified Capabilities

None. Existing user-facing behavior remains unchanged.

## Impact

- Affected package: `BIS/packages/integration`.
- Affected consumers: `BIS/packages/integration-admin` and `BIS/packages/marketplace`.
- Affected React imports, component files, CSS selectors, fixtures, and UI tests.
- No state-layer, wallet, persistence, network, or external API changes are intended.
- The renamed components may require coordinated updates across package exports and test hosts.
