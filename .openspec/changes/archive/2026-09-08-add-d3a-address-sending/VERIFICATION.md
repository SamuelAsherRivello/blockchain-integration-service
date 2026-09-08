# D3a Send verification — 2026-09-04

## Archive decision — 2026-09-08

The user explicitly requested archiving after being informed that task 3.2 remains incomplete. Archived with 7/8 tasks complete and all three delta specs synced. Live sender debit, recipient credit, finalization and restart acceptance remain unverified; task 3.2 stays unchecked. This archive decision supersedes the earlier instruction to keep the change active until live acceptance, but does not claim that acceptance passed. Earlier dated notes below preserve the verification history.

## Apply and sync recheck — 2026-09-08

- Current progress remains 7/8 tasks. All implementation tasks were already checked; the only remaining task, 3.2, requires selected clean Signet sender/recipient, user-confirmed payment, recipient credit/sender debit, finalization, fresh balances/Activity and restart evidence. Those public test details were requested; no real payment or account clearing was performed.
- Focused current tests passed: 15/15 across `sending.test.mjs`, `send-context.test.mjs`, `send-adapter.test.mjs` and demo `receive-selection.test.mjs`. These cover recipient/input/output binding, pre-network persistence, lost responses, late callbacks, quote expiry/replay, pending guards, monetary validation, journal restart and Activity deduplication.
- `npm run build` passed TypeScript and both package production builds for the current 0.14.1 checkout. Vite retained its large-chunk advisory. Unrelated concurrent work was preserved.
- Chrome `tests/send-host.html` passed on an isolated localhost server at port 5187 with file watching disabled after the shared development page repeatedly returned to its initial state. The fixture verified entry, clipboard race/denial, exact review, focus, Back, Max, expired review, duplicate-click protection, success, pending/reopen and 320px layout. All payment outcomes were isolated doubles, not live wallet evidence.
- The three selected delta specs were compared with main specs. The older blanket-lock wording in `Independent sending and recovery stories` was reconciled to the already-synced input-reservation requirement from `unblock-independent-wallet-operations`, preserving that later planning decision rather than overwriting main specs. This does not mark the separate independent-operations implementation complete. All three D3a specs now match requirement-by-requirement.
- Strict D3a validation passed and all 24 main specs passed validation. The change remains active pending the live acceptance evidence; it has not been archived or marked fully complete.
- Older logout/journal statements below describe the original implementation baseline. The later explicit pending-transaction acknowledgement/logout decision in `BIS/documentation/design-discussion.md` supersedes those logout statements; this recheck did not change logout, Admin Reset, spending guards or other capabilities.

## Scope and status

User-authorized split: D3a sends Signet sats from Arkade to another Arkade address. D5 pending-transfer recovery/cancellation is independent in `cancel-pending-transfer`; it is not required to implement D3a. Bitcoin destinations and Lightning are not advertised by this form.

Implementation and automated acceptance complete (tasks 1.1–3.1). Task 3.2 remains open: no live payment was authorized against selected clean accounts. The existing pending transfer was not cleared, cancelled, or spent around. Do not archive or claim live recipient-credit verification.

## Evidence

- `node --test packages/integration/tests/*.test.mjs packages/integration-demo/tests/*.test.mjs`: 122 passed, 0 failed. Includes domain, real SDK transaction-shape adapter, core guards, journal restart and unavailable-status tests.
- `npm run build`: passed, including TypeScript and both package production builds. Existing large-chunk warning remains.
- `openspec validate add-d3a-address-sending --strict` and `openspec validate cancel-pending-transfer --strict`: passed.
- Real Chromium at `http://localhost:5173/tests/send-host.html`: production Send UI using isolated API doubles passed entry, unsupported-route absence, clipboard race/denial, exact review and focus, Back, Max, duplicate click, success, pending/reopen and 320px layout checks. Screenshot `output/playwright/send-pending.png` was visually inspected. This is not live payment evidence.
- D3a Admin routing is covered by the demo selection test and consumes the public API.

## SDK and safety contract

Installed SDK 0.4.67 direct `Wallet.send` uses selected VTXOs, checkpoint transactions and finalization. The adapter verifies checkpoint linkage, reviewed input values, exact recipient/change outputs, anchor outputs and conservation before its intercepted submit boundary. It persists only allowlisted public transaction metadata before network submission; storage failure prevents submission. SDK settlement is disabled. Quotes expire and are single-use, profile-bound and revalidated against fresh inputs. Changed or nonzero operator fees fail closed.

Read-only operator information inspected during implementation reported Signet, dust 330 sats, minimum VTXO 1, maximum -1, empty intent fee expressions and transaction fee rate 0. This is a snapshot, never a hardcoded assumption: preparation checks live configuration again.

Scoped review found no secret logging, signed-transaction persistence, automatic settlement, cancellation, or blind resubmission in the new send path. A lost response stays pending; Check Status only reads exact transaction-output evidence. Core retains spending/logout/reset guards while unresolved. Cross-device concurrency still relies on fresh input checks and operator rejection.

## Remaining live acceptance

Follow-up UI request applied: Send and Transfer share `AmountChooserRow` (minus, numeric input, plus, Max). Send has no amount helper text underneath, and its recipient label uses the recovery screen's clipboard icon with an accessible Paste from Clipboard name. The expanded Send browser fixture and existing Transfer browser fixture both pass. The 320px Send entry screenshot `output/playwright/send-amount-chooser.png` was visually inspected; all controls fit on one row. Full 122-test suite and production build passed again after extraction.

Select a clean funded Signet sender profile and a separate recipient using only public identifiers. Confirm the reviewed amount in the app. Record finalized transaction, exact recipient credit/sender debit, fresh balances and Activity, and reopen behavior before checking task 3.2. Never use or clear the existing locked account as a shortcut.
