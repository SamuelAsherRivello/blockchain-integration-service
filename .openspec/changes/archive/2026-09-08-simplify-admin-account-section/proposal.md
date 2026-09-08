## Why

The Admin Account section repeats shortcuts into the same production Account flow. A compact story summary and two entry buttons make it easier to scan while retaining access to existing functionality.

## What Changes

- Update only A. Account in Admin: heading, ordered `Stories: A1, A2, A3, A4, A5, A6` summary, then two buttons.
- Keep A1. Account Button and A4. Account Dialog, in that order; rename the existing A4 label from Account Balance.
- Remove the Account-section shortcut buttons for A2, A3, A5, A6, D2a, D3a, and D4. Their production functionality remains accessible through Account.
- Add Stories summaries to B through F while preserving their controls and behavior, production UI, handlers, story identifiers, and wallet behavior.
- Planning assumption: the summary lists implemented A-series Account stories, as in the screenshot's A-series list. Appendix stories are not added, and inclusion does not upgrade pending live-verification status.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `story-driven-demo`: Replace redundant Account shortcuts with the ordered story summary and two production entry actions.

## Impact

Primary implementation surface: `BIS/packages/integration-demo/src/admin/AdminPanel.tsx`, with Account-scoped spacing in demo CSS if needed. Relevant demo navigation documentation and focused verification must reflect the two entry points. Other story sections receive summary lines only. No dependencies, public APIs, production package changes, or network operations are required. This proposal supersedes existing spec scenarios that require dedicated Create Account and other Account shortcut buttons.

