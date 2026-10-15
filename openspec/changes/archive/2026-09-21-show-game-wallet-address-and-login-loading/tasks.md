# Tasks

## 1. Game Wallet Login presentation

- [x] 1.1 Add the selected public Arkade address section to `GameWalletLogin` using the shared copyable value field, verify the exact `Arkade address` label, complete value, Copy action, ordering above `Log Out Game Wallet`, and absence of balance/boarding/recovery content in focused UI tests.
- [x] 1.2 Preserve selected-wallet and error isolation while rendering the address, verify a failed or superseded create/restore/select operation cannot expose a stale address or alter the prior selection.

## 2. Login loading behavior

- [x] 2.1 Register create, restore/import, and commit/select operations with the shared pending-operation prompt using the approved login loading wording, verify the prompt covers the page through final ready state and prevents pointer/keyboard interaction with covered controls.
- [x] 2.2 Verify terminal errors resolve through the existing safe error presentation and keep the prior wallet/address unchanged, while duplicate login actions remain disabled.

## 3. Verification

- [x] 3.1 Run the focused Game Wallet UI/component tests and shared pending-operation tests, verifying address copy success/failure feedback and all login loading scenarios.
- [x] 3.2 Browser-verify the supported narrow Game Wallet Login page, confirming the full Arkade address field and Copy action fit above logout and that the loading prompt is visible until login readiness; record generated artifacts under `output/` if screenshots or logs are produced.
