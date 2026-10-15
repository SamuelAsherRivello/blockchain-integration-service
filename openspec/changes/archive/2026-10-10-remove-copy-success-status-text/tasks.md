# Tasks

## 1. Shared Copy Primitives

- [x] 1.1 Update shared value/text-field and item-list renderers so successful clipboard completion relies only on the checked copy control and no visible or screen-reader success-status line is rendered; verify the components still pass typecheck.
- [x] 1.2 Preserve failed-copy messages, selectable values/reports, retry behavior, and stale-result protection in shared renderers; verify denied and delayed clipboard writes remain actionable without checked success feedback.

## 2. Consumer Normalization

- [x] 2.1 Remove success announcements from recovery phrase, recovery info, transfer recovery, pending-operation, item-list, and standalone onboarding consumers while retaining actionable failure guidance; verify their focused fixtures show checked controls without success text.
- [x] 2.2 Convert the custom transaction recovery copy action to the shared checked-control copy pattern without changing its accessible label or copied payload; verify success, failure, retry, and unmounted behavior.
- [x] 2.3 Update Account Details, Receive, activity, asset, recovery, and report fixtures to assert no success text for every copy button while retaining exact payload, disabled, failure fallback, and stale-result checks.

## 3. Integration Verification

- [x] 3.1 Run the integration package typecheck, build, and all relevant browser fixtures; verify every BIS copy-button category passes and no unrelated operation status behavior regresses.
