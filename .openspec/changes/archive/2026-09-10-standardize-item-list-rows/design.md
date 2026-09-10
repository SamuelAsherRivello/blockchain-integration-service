## Context

See `proposal.md` for the confirmed closed-row samples. `ItemList` already owns the common list/detail frame and `.bis-collection-item` owns the base button geometry. `AccountActivity`, `AccountAssets`, and `AccountContracts` compose different child structures, while `ToastViewport` already defines the information, success, warning, and error colors and matching SVG status glyphs. The project has no emoji package; its current icon-text convention uses native Unicode emoji such as `⚡`.

The existing detail pages and copy reports already carry complete identifiers and technical information. This design changes only the closed item presentation.

## Goals / Non-Goals

**Goals:**

- Make operation, cost, and status immediately scannable where those concepts apply.
- Present exactly six visible `emoji: value` fields in a consistent two-column by three-row grid.
- Reuse actual toast status colors and glyphs rather than creating a parallel status language.
- Preserve asset artwork as the preferred leading visual.
- Keep the status background stable across hover, focus, and selected states.
- Preserve the existing fixed list viewport and accessible list/detail navigation.

**Non-Goals:**

- Showing visible text labels beside the six emoji.
- Inventing operation, cost, timestamps, metadata, or statuses that the source data does not provide.
- Changing detail fields, copy reports, data ordering, loading/error behavior, or wallet operations.
- Adding an emoji library, UI library, public API, persistent state, or Arkade/core type solely for presentation.

## Decisions

### 1. Use one shared compact-row structure

A shared internal row component will accept a leading visual, status type, and six presentation fields. It will render the leading visual beside a two-column by three-row CSS grid. Each field contains an `aria-hidden` native Unicode emoji, a visible colon, and the formatted value. Its text label exists only as screen-reader content or an equivalent accessible name.

This avoids three near-duplicate grids and makes layout, truncation, status styling, and interaction styling testable in one place. Keeping free-form React children was considered, but it would make the exact six-field contract easy to drift.

### 2. Keep a stable left-context/right-outcome grid

Fields are assigned row-major so the left column describes identity/context and the right column carries value/lifecycle:

```text
Transaction                 Asset                       Contract
⚙️: operation | 🪙: cost    🏷️: name   | 🔢: quantity  ⚙️: type    | 🪙: cost
📡: network   | ✅: status  🔤: ticker | ✅: owned     🎯: purpose | ⏳: status
↙️: direction | 🕒: time    🎯: decimals| 🌐: network   👤: role    | 📅: expires
```

The transaction direction emoji changes to `↗️` for outgoing movement and uses an appropriate bidirectional presentation for transfers. A pending status can use `⏳`; a completed status can use `✅`. These field emojis are separate from the larger leading toast glyph.

For assets, quantity rather than cost is shown because holdings do not provide acquisition cost. `Owned` and `Off-chain` are presentation facts of the current account asset collection, while missing name, ticker, or decimals must use truthful fallback text. This preserves six useful values without inventing an asset operation.

### 3. Reuse toast glyphs and status palettes

The existing toast status SVG will be extracted or otherwise shared as an internal presentational primitive so list rows use the same information, success, warning, and error glyphs. Rows will apply the existing toast palette by a shared status-type attribute:

- information blue: pending, preparing, registered, unresolved, refunding, claiming, funding, or otherwise active/unverified;
- success green: confirmed, settled, verified, recorded, refunded, claimed, or owned;
- warning yellow: not submitted, unavailable, expired without an active refund, or another truthful warning;
- error red: explicit failed/error state.

An asset's prepared metadata artwork replaces the leading status glyph. Failed or missing artwork falls back to the row's status glyph. The row background still follows status even when artwork is present.

Copying the SVG paths and hex values into each list was considered, but sharing the toast primitive and palette prevents visual drift.

### 4. Use outlines only for interaction feedback

The colored background and status border never change on hover, focus, or selection:

- hover: 2px black outline;
- keyboard focus: at least 2px black focus-visible outline with sufficient separation from the status border;
- selected: persistent 3px black outline while the selected row is rendered.

Outlines do not consume layout space, so row dimensions and scroll position remain stable. Selected styling takes precedence when selected and hovered. Existing `aria-pressed` state and focus restoration remain authoritative.

### 5. Keep complete information in detail

Closed rows omit transaction IDs, contract IDs, and contract references. Long grid values remain single-line and truncate within their own cells. Complete values, identifiers, evidence, recovery information, and timestamps remain in the existing detail page and copy report.

When a transaction timestamp is unavailable, the time value uses truthful fallback copy such as `Not reported`. The UI never substitutes the current time.

### 6. Verify semantics and real layout

Focused presentation tests will cover field selection/order, direction and status mapping, timestamp fallback, status-color classification, leading artwork/status fallback, hidden accessible labels, and unchanged selection/detail behavior. A browser fixture at the supported narrow 9:16 presentation will verify the two-by-three grid, stable status backgrounds, black hover/focus/selected outlines, artwork alignment, truncation, and absence of horizontal overflow.

## Risks / Trade-offs

- [Six fields may feel dense at the current row height] → Use the existing compact typography, fixed three grid rows, and per-cell truncation; verify in the narrow browser fixture before acceptance.
- [Emoji rendering varies by platform] → Use native Unicode already consistent with project practice, keep the colon/value layout stable, and provide nonvisual accessible labels.
- [Users may not immediately recognize every emoji] → Use one consistent mapping across all rows and retain complete, conventionally labeled detail pages.
- [A status can have multiple technical stages] → Classify color from the truthful lifecycle group and show the most relevant current human-readable status value.
- [Shared toast styling changes could unintentionally affect notifications] → Share palette/glyph primitives without changing toast layout or playback, and run toast regression tests.
- [Remote asset artwork may load after the row is visible] → Preserve prepared-image behavior and fixed leading-visual dimensions so loading cannot change row geometry.

## Migration Plan

1. Introduce the internal compact-row, accessible emoji-field, and reusable toast-status presentation primitives.
2. Map transaction, asset, and contract data into their confirmed six field positions without changing source models or reports.
3. Apply status palettes and outline-only hover/focus/selected styling.
4. Run focused integration and toast tests, the root typecheck/build, and the narrow browser visual check.
5. Roll back by reverting only the scoped presentation component, mappings, and CSS; no stored data or API migration is involved.

