## Context

See proposal.md for motivation. Back is rendered in seven production UI files. Most buttons sit inside `.bis-actions`; detail and recovery views also use `.bis-transaction-back`. Styling is owned by `overlay.css`. Existing focus refs and pending-operation guards must remain attached to the same buttons.

## Goals / Non-Goals

**Goals:** Share one restrained visual treatment across all Back action renderers, including single-action dialogs.

**Non-Goals:** Change navigation, wallet operations, public APIs, or header Close controls.

## Decisions

- Add a shared Back modifier class to the existing buttons and a decorative CSS pseudo-element above each. This avoids wrapper changes to existing action layouts and preserves refs and keyboard semantics. Explicit markup separators are an alternative but would add repeated decorative elements at every render site.
- Use three centered 2px circular dots, 6px apart, initially `rgba(82, 107, 116, 0.28)`, with roughly 6px clearance above the button and a small additional top margin. Final spacing must account for existing action gaps and detail footer margins so it remains slight. Avoid a prominent rule or large footer area.
- Keep the separator noninteractive and outside the button hit area. It must appear only when its Back button renders, including disabled states. Do not style all last buttons, which would affect dialogs without Back.
- Verify with existing browser fixtures and a narrow 9:16 host. No Signet operations are needed to validate this presentation-only change.

## Risks / Trade-offs

- Added vertical space could clip compact dialogs → inspect restoration, asset detail, transaction detail, and recovery reports in short hosts; retain existing scrolling.
- Parent and child renderers could produce duplicate treatment → apply the modifier only at each actual Back button and check one three-dot separator per visible Back.
- Three faint dots can disappear at preview scaling → visually check normal and reduced demo scale while keeping it less prominent than button borders.

## Migration Plan

Ship with the ordinary UI build; no data migration. If adjustment is needed, change the shared style. Reverting this feature requires only additive edits removing its modifier and CSS, without discarding unrelated work.
