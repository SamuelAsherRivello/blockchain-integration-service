## Why

Assets, Contracts, and Transactions already share one list/detail frame, but their closed rows prioritize different information and are difficult to compare quickly. A compact status-colored row with six immediately relevant values will make operation, cost, and status visible before the player opens the complete detail page.

## What Changes

- Give every closed item a leading visual: use supplied asset artwork when available; otherwise use the same status-type icon language as the existing toasts.
- Arrange six compact fields as two columns by three rows. Each field is visibly formatted only as `emoji: value`; visible text labels are omitted, while accessible names explain every emoji.
- Use the project's existing native Unicode emoji convention for the six field icons; do not add an emoji or UI dependency.
- Use the existing toast status palette for the item background and border: information blue for pending/unresolved work and success green for done/confirmed/owned work. Existing warning and error toast colors remain available for truthful warning/error states.
- Keep the status-colored background unchanged on hover, focus, and selection. Hover adds a black outline, keyboard focus adds an equally visible black outline, and a retained selected row uses a stronger persistent black outline when shown.
- Remove shortened transaction and contract identifiers from the closed-row priorities. Full IDs, references, evidence, timestamps, and recovery data remain available in the open detail and existing copy reports.
- Preserve current list/detail navigation, data ordering, loading/error behavior, and full detail content.

Closed-row text samples:

```text
TRANSACTION — done / green
┌──────────────────────────────────────────────────────┐
│ ✅  ⚙️: Contract claim      🪙: 1,000 sats            │
│     📡: Off-chain           ✅: Confirmed             │
│     ↙️: Incoming            🕒: 8:26 AM               │
└──────────────────────────────────────────────────────┘

ASSET — owned / green
┌──────────────────────────────────────────────────────┐
│ 🏆  🏷️: Achievement: Level 1 🔢: 1                   │
│     🔤: LVL1                ✅: Owned                 │
│     🎯: 0 decimals          🌐: Off-chain             │
└──────────────────────────────────────────────────────┘

CONTRACT — pending / blue
┌──────────────────────────────────────────────────────┐
│ ℹ️  ⚙️: Limited-time offer  🪙: 1,000 sats            │
│     🎯: treasureLTO         ⏳: Refunding             │
│     👤: Player              📅: Sep 10, 8:26 AM       │
└──────────────────────────────────────────────────────┘
```

The leading `✅` and `ℹ️` represent the existing toast success and information glyphs, not replacement emoji. The trophy represents supplied asset artwork. The samples define information priority and grid position; long values truncate within their cell and remain complete in the opened detail.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `transaction-row-presentation`: Replace the identifier-oriented three-line row with a status-colored six-field operation summary.
- `account-assets`: Present six trustworthy ownership fields beside asset artwork, or a status icon when artwork is unavailable.
- `account-contracts`: Present six contract-summary fields beside the matching toast status icon.

## Impact

- Affects shared collection-row presentation plus transaction, asset, and contract row composition under `BIS/packages/integration/src/ui/`.
- May add presentation helpers for lifecycle color/icon classification and compact date/value formatting under `BIS/packages/integration/src/`.
- Requires focused tests under `BIS/packages/integration/tests/` and a narrow browser fixture under `BIS/packages/integration-demo/tests/`.
- Does not change public APIs, stored data, wallet/core operations, list ordering, copy-report content, detail content, dependencies, or Arkade behavior.
