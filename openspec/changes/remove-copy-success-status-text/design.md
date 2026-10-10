# Design

## Context

The BIS UI has a shared `CopyButton`/`CopyFieldLabel` path, but success announcements are also emitted by item lists, recovery phrase panels, recovery dialogs, transfer recovery, and a custom transaction recovery action. The standalone onboarding spike has two separate vanilla copy controls that write directly to the clipboard and report success through status text. Some actions already use the checked icon; custom actions need to adopt equivalent checked-state feedback. The existing clipboard hook already distinguishes successful and failed writes and protects against stale scopes, so the React change remains UI-local while the spike receives a small local state update.

## Goals / Non-Goals

**Goals:**

- Make the checked copy control the sole success indication for every BIS copy action.
- Remove visible and screen-reader success announcements from all copy consumers.
- Route custom direct-copy actions through the shared copy-state pattern so they also show a checked control, and give the standalone spike equivalent local checked-state behavior.
- Preserve failure text, manual-copy usability, copied payloads, and stale-result protection.
- Verify all copy categories through focused Admin host fixtures and package checks.

**Non-Goals:**

- Do not remove actionable errors from copyable text areas, recovery reports, or unrelated operation status messages.
- Do not change copied values, clipboard permissions, button accessibility labels, or copy timing.
- Do not change wallet, account, balance, address, or transaction data behavior.

## Decisions

### Keep failure feedback, remove only successful feedback

The renderer will continue to expose manual-copy guidance after a failed write, while successful completion will render no bottom status text. This preserves recovery and accessibility information for an actual error without duplicating the checked-button confirmation.

Alternative considered: remove all status output, including failure guidance. Rejected because the existing contract requires a truthful fallback when clipboard access is unavailable.

### Change shared primitives and normalize exceptional consumers

The implementation will remove success output from shared value/text renderers, item lists, recovery panels, and transfer recovery. The custom transaction recovery action will adopt `useClipboardCopy` and `CopyButton` so it participates in the same checked state and stale-result behavior.

Alternative considered: pass `feedback={false}` at each call site. Rejected because it is easy to miss consumers and would leave the shared component capable of reintroducing redundant success output.

### Verify the visible contract through the existing fixture

The focused copy fixture will assert the checked icon/title after successful copy and the absence of success output. Existing Account Details, Receive, activity, asset, recovery, and report fixtures will be updated to assert the same contract while retaining failure, fallback, disabled, retry, and stale-result checks.

## Risks / Trade-offs

- [Risk] A consumer may rely on the old success text for a bespoke assertion or layout.
  → Mitigation: search all copy consumers and update success-specific expectations; retain failure-specific assertions.
- [Risk] Replacing the custom transaction recovery button could alter its layout or accessible name.
  → Mitigation: preserve the existing “Copy Recovery Details” accessible name and verify its action in the activity fixture.
- [Risk] Removing the element changes vertical spacing in compact layouts.
  → Mitigation: run the existing narrow/portrait renderer checks and inspect the shared layout after the change.
