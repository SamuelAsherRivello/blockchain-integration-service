## Why

One unresolved transfer currently freezes unrelated spending throughout the app. Replace that policy with input-specific reservations and a useful recovery screen, without pretending a local dismissal reverses a network transaction.

## What Changes

Confirmed in the 2026-09-08 Grill Me interview: apply one shared reservation policy across BIS, verify B1 first, reconstruct missing legacy inputs where possible, grey out B1 when verified independent funds are insufficient, and enable supported operations without waiting for mint input-control support. Completion requires live B1 success while an unrelated transfer remains pending, verified receipt of 1,000 sats by the game wallet, and preservation of the original recovery record.

- Permit new sends, transfers and mints using verified funds disjoint from every unresolved operation; retain duplicate-operation and conflicting-input protection.
- Store multiple durable operations and their exact input reservations, with migration preserving existing recovery records.
- Add an Account recovery view showing each operation, available versus reserved funds, permitted actions and concrete reasons for unavailable actions. Reuse Check Status and Copy Recovery Details.
- Allow discarding drafts proven never submitted. Offer confirmed network cancellation only when the existing D5b feasibility requirements pass; otherwise explain the limitation and provide recovery details. Independent spending and recovery inspection do not depend on cancellation feasibility.
- Keep Log Out and Reset blocked while unresolved records depend on the current local recovery context. Account switching/export-import recovery is deferred.
- Document the resulting capability matrix and verify actual independent spending before claiming the currently affected account is unblocked.

## Capabilities

### New Capabilities
- `wallet-operation-availability`: Durable input reservations, independent operations and actionable recovery presentation.

### Modified Capabilities
- `account-boarding-settlement`: Replace blanket transfer blocking with conflicting-input blocking and preserve multiple operations.
- `account-address-sending`: Permit sending alongside unrelated pending operations.
- `asset-api`: Permit independently funded mint operations while retaining operation-ID retry protection.
- `account-transfer-cancellation`: Scope unresolved cancellation guards to affected inputs; separate recovery delivery from conditional cancellation delivery.

## Impact

Integration core storage, context, quotes, Arkade input selection and mint adapter; production Account recovery UI; Admin mint availability; focused tests and user-story documentation. No new backend, automatic funding or SDK upgrade is assumed.

This proposal supersedes blanket-spending requirements in the affected main specs and overlapping active changes when applied. Existing cancellation targeting/finality prerequisites remain binding. Implementation must reconcile the corresponding active artifacts without claiming their outstanding verification tasks complete.

Unresolved feasibility: supported SDK control of all mint inputs and the deployed operator's cancellation guarantees. These are per-feature gates, not reasons to halt independent deliverables. The interview decisions above are confirmed; unresolved SDK and operator capabilities still require evidence. No runtime or wallet changes are made during this planning update.
