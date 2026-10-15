# Design

## Context

The integration UI already has shared primitives, but their responsibilities are split across `CopyableValueField`, `CopyableTextArea`, `ReportTextArea`, `CopyFieldLabel`, `FieldHeading`, and `ReviewDetails`. Account, Admin, and Marketplace consumers also contain equivalent inline value markup. See `proposal.md` for the motivation and scope.

## Goals / Non-Goals

**Goals:**

- Establish `FormValue` as the shared short and multiline label/value primitive.
- Make copying an explicit `copyable` capability while preserving the existing clipboard hook and failure fallback.
- Give domain wrappers and screen components consistent domain-first names, such as `AccountBalancesFormValue` and `AccountActivityView`.
- Preserve DOM semantics, accessible names, CSS behavior, visual layout, copied payloads, and runtime data flow unless a consumer is being brought into the shared field pattern.

**Non-Goals:**

- Do not change wallet, account, balance, address, transaction, asset, or marketplace behavior.
- Do not change state-layer APIs, persistence, network behavior, or Arkade integration.
- Do not force review lists, dialog shells, or domain containers to become `FormValue` instances.

## Decisions

### Use one `FormValue` component with explicit capabilities

`FormValue` will support both single-line and multiline content through a `multiline` prop. Copy behavior will be enabled with `copyable`; unavailable or loading values will use `disabled`. Optional injected clipboard state remains supported for consumers that need a shared copy scope.

Conceptually:

```tsx
<FormValue label="Total balance" value="1,000 sats" copyable />
<FormValue label="Transaction report" value={report} multiline rows={12} copyable />
```

The component will own the input/textarea selection behavior, copy button state, failure guidance, and disabled handling. `CopyFieldLabel` becomes an implementation detail or is removed after all consumers migrate.

Alternative considered: retain separate value and report components. Rejected because it preserves duplicate copy behavior and allows field presentation to diverge.

### Keep domain wrappers separate from the primitive

`AccountBalancesFormValue`, `AccountAddressesFormValue`, and `AccountIdentityFormValue` will remain domain wrappers. They will format state and compose one or more `FormValue` instances; they will not duplicate clipboard or field layout logic.

Alternative considered: expose only generic `FormValue` at every call site. Rejected because domain wrappers provide a stable place for account-specific formatting, loading state, tooltip content, and grouping.

### Use domain-first suffix naming for screen components

Screen and window components will use suffixes such as `View`, `Dialog`, `Panel`, and `Form`: `AccountActivityView`, `AssetMintDialog`, `AdminGameWalletView`, and `RecoveryPhraseForm`. Generic field primitives remain `FormHeading`, `FormTooltip`, `FormValue`, and `FormValueList`.

Alternative considered: prefix screen components with `View`. Rejected after the naming decision to use `AccountActivityView`-style names.

### Migrate consumers in dependency order

The implementation should first establish and export the new primitives, then migrate integration wrappers and views, followed by Admin and Marketplace consumers, and finally remove obsolete aliases/files after tests and CSS references are updated. This keeps intermediate states buildable and makes the rename easy to review.

## Risks / Trade-offs

- [Risk] A rename can leave stale imports, CSS selectors, fixtures, or package exports. → Mitigation: search the complete BIS source, tests, and package entrypoints for every old symbol before removal, then run package tests and type/build checks.
- [Risk] Consolidating textarea and input rendering may alter compact layouts. → Mitigation: preserve existing class hooks and add only a documented multiline modifier; verify Account, Admin, and Marketplace view fixtures.
- [Risk] Disabled values may change copy-button behavior where the old component was inconsistent. → Mitigation: treat truthful disabled behavior as the intended shared contract and add focused tests for loading, unavailable, and empty values.
- [Risk] Domain-first renames may affect consumers outside the visible UI packages. → Mitigation: update public exports and run repository-wide symbol searches before deleting compatibility names.

## Migration Plan

1. Add `FormValue`, `FormHeading`, `FormTooltip`, and `FormValueList` exports while preserving current behavior.
2. Move single-line and multiline copy behavior into `FormValue`; update focused component tests.
3. Rename and migrate account value wrappers and account view components.
4. Migrate collection, recovery, Admin, and Marketplace consumers.
5. Update CSS, fixtures, exports, documentation references, and test selectors.
6. Remove obsolete component names once no repository references remain.
7. Run the existing BIS test/build and UI verification commands.

Rollback is a source-control revert of the refactor. No persisted data, network state, or external contract migration is required.
