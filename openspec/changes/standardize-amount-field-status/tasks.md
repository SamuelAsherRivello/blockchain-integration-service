# Tasks

## 1. Page status presentation

- [x] 1.1 Add one standalone status-line rendering path to each target view, immediately after the shared sats amount control, and verify no view renders a second status field.
- [x] 1.2 Add styling for a single wrapping status line and verify it preserves the compact portrait layout and accessible dynamic-status behavior.

## 2. Send and Account Transfer integration

- [x] 2.1 Update Send with `Send balance to another address.`, its default and replacement status messages, and operation-error-prompt separation; verify Send entry behavior with focused tests.
- [x] 2.2 Update Account Transfer with `Swap between your balances.`, priority-selected default and replacement status messages, and operation-error-prompt separation; verify transfer behavior with focused tests.

## 3. End-to-end verification

- [x] 3.1 Extend browser or component coverage to assert the fixed body text and exactly one standalone status line per view, including a pending transfer with zero amount.
- [x] 3.2 Run the relevant integration package tests and repository compile checks, verifying no existing Send or Transfer workflow behavior regresses.
