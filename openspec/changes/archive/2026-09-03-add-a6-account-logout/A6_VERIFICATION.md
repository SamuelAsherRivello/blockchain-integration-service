# A6 verification

Status: implementation and isolated verification complete; manual browser-storage logout verification pending.

## Automated and browser evidence

- `node --test packages/integration/tests/*.test.mjs`: core creation/entry regressions and logout guards, cancellation, failed clearing, ambiguous completion, retry, duplicate submission, account replacement, disconnection events, multiple contexts, and disposal/reset races. All storage used by these tests is in-memory test data.
- `npm run build`: type checking plus integration and demo production builds pass. Vite reports the existing large-bundle warning.
- Local browser: the actual Admin A6 action opens the logged-out chooser when there is no saved account, without automatically creating one.
- `/tests/logout-host.html`: test-only storage doubles drive the real context/UI and Runtime Preview component. Component checks pass for checkbox toggling, accessible labeling, cancellation, reopening, failure/Retry, successful logout, disabled Restore, and return to the Account button. This fixture is not imported into the demo.
- `/tests/logout-host.html?plain`: the same component checks pass without demo CSS. The 300-by-540 host renders the confirmation with usable controls.
- Visual inspection covers 100%, 50%, and 25% preview scale; changing scale preserves acknowledgement. Tab then Space checks the checkbox and enables Log Out. No phrase is displayed or captured.

## Manual real-storage checklist

The repository prohibits agent-executed database deletion. The user must perform these steps with a disposable Signet account; never share a recovery phrase in evidence. These checks are still pending.

1. In the local demo, create a disposable account through A2 and finish Continue. Open a second same-origin tab and select A6 there so both recognize that account.
2. In the first tab select A6, open Log Out, check and uncheck the acknowledgement, then press Back. Confirm the account remains active and survives refresh. Reopen confirmation and verify the checkbox starts unchecked.
3. Check the acknowledgement and press Log Out. Confirm the chooser appears with Restore disabled and the selected A6 story remains selected. The second tab should reconcile to logged out. Back must leave the host usable.
4. Reload both tabs, select A6, and confirm the old account does not return. Confirm unrelated application/browser data remains available.
5. Repeat with a new disposable account: load Account, make the operator/network unavailable, and confirm logout still completes locally. Reconnect before reloading the development page if necessary.
6. Use `/tests/ui-host.html` on the same origin to confirm real persisted-account recognition, cancel safely, and manually complete logout there. The production layer should return to its Account button via Back, without relying on demo CSS.
7. Report outcomes for these steps, including any failure text with secrets excluded. A6 remains awaiting full verification until the results are recorded.

Storage failures and commit/read races are covered deterministically by doubles; the manual steps establish that the real IndexedDB and browser notification path matches those contracts.
