# A3 account restoration verification

Verified locally on 2026-09-03. Scope is account access only; this is not evidence for balances, achievements, payments, or the full Account menu.

## Adapter and lifecycle

- Installed SDK 0.4.67 and BIP39 2.0.1 were inspected. A2's default 128-bit English generation produces twelve words; restoration uses the same identity derivation and public-key hash.
- The live operator info endpoint returned `signet`.
- `node --test packages/integration/tests/*.test.mjs` passed all 32 tests covering validation, Signet rejection, cleanup, cancellation, duplicate submission, save retry, uncertain commits, hydration, and concurrent changes alongside A1/A2/A6 regression coverage. Test identities are generated only in memory; assertion output contains no phrases.
- Temporary wallet deadlines include address acquisition. Acquired wallets are disposed even when an operation times out; late acquisition is also disposed.

## Browser verification

Follow-up: verified multi-word entry into a middle field, sequential keyboard typing, per-field paste, and overflow preservation. Mask lengths and local validity update for each populated word.

The Vite demo was already available at `http://127.0.0.1:5173/`. Verification used separate Playwright browser sessions and the independent `tests/restore-host.html` fixture.

- Isolated production-UI checks passed in desktop Chromium and mobile/touch emulation: twelve fields, initially hidden input, Show checkbox, one asterisk per character, valid/invalid word indicators, checksum failure with green words, successful paste, wrong-count preservation, clipboard denial, stale paste after editing, connection failure/Retry, direct Account destination, and Back clearing.
- Real keyboard input passed insertion, backspace, select-all replacement, and forward deletion while hidden. Input labels explicitly identify word positions; indicators supply non-color accessible status.
- Fresh persistent-browser live verification created a disposable identity through the production A2 adapter without displaying or committing its phrase, then restored it through the actual A3 grid using an in-page clipboard seam. Signet connection and real encrypted saving succeeded, the public profile ID matched, and accountConnected fired once.
- The restored account reopened in a new production context, after page reload, and after closing/reopening the browser with the same dedicated profile.
- Admin A3 selection opens the production chooser when logged out and the minimal Account dialogue when an account is saved. Active routing offers no replacement grid. Story navigation is disabled while the dialogue is open.
- Empty-grid screenshots are in ignored `output/playwright/a3-empty-grid.png` and `output/playwright/a3-demo.png`. No revealed recovery phrases, clipboard contents, or database records were captured.

## Boundaries

Final documentation check reproduced Windows-1252 decoding of the raw Markdown link despite valid UTF-8 source. README and User Story Diagrams now use a UTF-8 BOM and the checkmark `✓`. Browser verification reports UTF-8, a readable checkmark, and no mojibake. Preserve that BOM when rewriting either directly served Markdown file.

Clipboard success/denial tests use an in-page seam rather than changing the user's operating-system clipboard. Mobile verification uses touch emulation, not a physical iOS/Android device. The live account-access test required no deletion, reset, or logout of real persisted data; existing accounts were preserved. The earlier A2/A6 manual storage-clearing checks remain pending and are not claimed complete by this evidence.

`npm run build` verifies typechecking and both production bundles. Vite retains its large-bundle advisory for the SDK-containing demo. The only browser resource error observed was the existing missing favicon; password-input form hints were informational.
