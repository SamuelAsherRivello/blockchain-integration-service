# Tasks

## 1. Establish the shared form-value primitives

- [x] 1.1 Rename `CopyableValueField` to `FormValue`, add `copyable`, `multiline`, disabled, tooltip, selection, and injected-copy handling, and verify focused component tests cover single-line, multiline, disabled, loading, success, failure, and stale-copy states.
- [x] 1.2 Rename `FieldHeading` to `FormHeading`, `BalanceTooltip` to `FormTooltip`, and `ReviewDetails` to `FormValueList`; update exports and verify TypeScript imports resolve without compatibility duplicates.
- [x] 1.3 Consolidate `CopyableTextArea` and `ReportTextArea` consumers onto `FormValue` with `multiline`, preserve selectable manual-copy fallback, and verify activity, recovery, and pending-operation report fixtures.

## 2. Migrate integration domain wrappers and views

- [x] 2.1 Rename and update `AccountBalancesFormValue`, `AccountAddressesFormValue`, and `AccountIdentityFormValue` wrappers to compose `FormValue`; verify account detail, receive, send, onboarding, and game-wallet fixtures.
- [x] 2.2 Rename account screen components to domain-first view names, including `AccountActivityView`, `AccountAssetsView`, `AccountContractsView`, `AccountOnboardingView`, `AccountSendView`, `AccountTransferView`, and `GameWalletLoginView`; verify all `BisAccountView` routes render.
- [x] 2.3 Rename collection, recovery, and account restoration components according to the approved suffix convention, update CSS selectors and test hosts, and verify `npm run typecheck`.
- [x] 2.4 Replace remaining inline integration balance, address, price, metadata, and report fields with `FormValue` or `FormValueList`; verify no old field component symbols remain under `BIS/packages/integration/src`.

## 3. Migrate Admin and Marketplace consumers

- [x] 3.1 Rename Admin view, panel, dialog, and preview components using domain-first names and migrate their imports; verify Admin build and story-panel fixtures.
- [x] 3.2 Replace Marketplace metadata and wallet-value markup with `FormValue` where the content is a reusable label/value field, preserving compact layout and copy behavior; verify Marketplace build and detail-view checks.
- [x] 3.3 Update package entrypoints, test fixtures, documentation references, and CSS selectors for the new names; verify repository-wide search finds no obsolete component imports or references.

## 4. Integration verification and cleanup

- [x] 4.1 Remove obsolete component files and aliases only after the repository-wide reference search is clean; verify the intended `Form*` and domain-first `*View` exports are present.
- [ ] 4.2 Run `npm run test` and `npm run build`, then verify Account, Admin, Marketplace, onboarding, and integration routes retain their existing behavior and visual composition.
