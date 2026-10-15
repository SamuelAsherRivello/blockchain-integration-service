## Why

The original demo showed a placeholder account dialog and explanatory admin filler. This change establishes reusable account entry, a lean story-driven demo, and documentation that accurately tracks completed user stories.

## What Changes

- Introduce A1: Open Account, replacing the coming-soon dialog with the production Account dialogue through a shared public entry point.
- Replace admin filler with implemented stories only, grouped into categories that contain at least one implemented story. Initially show Account / Account Button; hide Pay-to-play and Achievements.
- Start with no selected story and an empty Runtime Preview UI. Selecting Account Button renders the production button centered in the viewport; clicking it opens the Account dialogue.
- Expose createBisContext(), createBisAdminContext(context), and createBisUi(context). The UI mounts into a host container and exposes showAccountButton(). Admin primarily consumes production state, with the admin context reserved for specific development needs.
- Expose context.openAccountDialog() so a game's own controls can open the same dialogue without rendering the BIS Account button.
- Use Admin > User Stories > Documentation link, followed by Account > Account Button, with no Interactivity heading. Bundle the linked Markdown with the demo.
- Add 100%, 50% (default), and 25% preview scale, with demo-owned DOM scaling that preserves runtime state. Show Game Viewport only when runtime content is empty.
- Standardize the Account dialogue: title, current login-state text, disabled primary Create Account, disabled secondary Restore Account, and enabled secondary Back; equal-width action buttons and no decorative title icon or coming-soon copy.
- Add Reset Client: recreate transient client/UI state, preserve persisted data, clear the selected story, and leave runtime content empty.
- Keep demo page, navigation, and preview framing dark and demo-owned. Give production account UI a distinct lighter design, with all its styles owned by integration.
- Update the user-story document and relevant boundary documentation together with the implementation. Preserve story identifiers and clearly distinguish implemented, partial, and planned flows.
- Establish a continuing completion rule: new integration behavior has a corresponding demonstration in the admin and accurate user-story documentation.

## Capabilities

### New Capabilities
- `account-entry`: Shared production Account dialogue and its opening/closing behavior.
- `story-driven-demo`: Lean story navigation, accurate availability, package/style boundaries, and synchronized documentation.

### Modified Capabilities
None. These capabilities were introduced by this change and have already been synced to main specs; their delta sections remain ADDED for this change's history.

## Impact

- Integration: public account entry point, minimal account-view state, reusable UI, and isolated production styles.
- Demo: admin navigation, shared integration instance, preview composition, and scoped dark styles.
- Documentation: `documentation/User Story Diagrams.md`, relevant package READMEs, and boundary/design documentation as needed to remove stale descriptions.
- No new dependency, wallet initialization, account creation/restoration, payments, achievements, or server work is proposed.

## Confirmed story boundary

A1 is the complete no-profile flow: render Account button, open Account dialogue, then Back. Create/Restore remain visible and disabled; their functionality belongs to A2/A3. Active-profile opening and the account menu belong to A4, not a dependency blocking A1 completion. The game owns Gear placement and ordinary gameplay.

Each story must be small enough to complete fully. Split overly broad diagrams explicitly, preserving remaining work as named stories. Complete one small story, try it together, then refine it with hands-on feedback.

