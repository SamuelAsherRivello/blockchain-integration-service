## 1. Scope and adapter contract

- [x] 1.1 Separate D3a Send and D5 recovery proposals/stories, inspect installed SDK direct-send construction/finalization, and record exact fee/input/recovery contracts; verify both OpenSpec changes.
- [x] 1.2 Add failing tests for amount/fee/change constraints, quote binding and durable transaction records; implement the provider-neutral contract and pass those tests.

## 2. Production sending

- [x] 2.1 Implement read-only preparation and explicit SDK direct-send submission with validated recipient/input/output binding and pre-network persistence; verify adapter tests and no automatic settlement.
- [x] 2.2 Integrate issued-quote confirmation, shared spending/account guards, duplicate protection, durable status and read-only reconciliation into the public API; verify core lifecycle/restart/storage/error tests.
- [x] 2.3 Replace the placeholder with entry/Paste/Max, separate review, explicit confirmation and truthful status using existing styles; verify isolated production-UI browser tests including Back, keyboard, narrow host and stale async results.
- [x] 2.4 Add the D3a Admin demonstration through public APIs and synchronize user-story/package docs without adding unavailable D5 controls; verify selection and documentation tests.

## 3. Acceptance

- [x] 3.1 Run integration/demo tests, typecheck/build and scoped security review; record exact results.
- [ ] 3.2 With explicitly selected clean Signet sender/recipient and user confirmation, verify recipient credit, sender debit, finalization, fresh balances/Activity and restart; keep this task pending if live evidence is unavailable. Do not clear or cancel the existing account's transfer.

D5 Cancel Pending Transfer is independent and is not a prerequisite for tasks 1.1–3.1. This change does not implement Bitcoin destinations or D3b invoice sending.
