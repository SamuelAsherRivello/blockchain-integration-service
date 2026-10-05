# D1 Show Toast verification

Date: 2026-09-07. Implementation is in the current workspace; no remote deployment or live wallet mutation was performed.

## Implemented behavior

- `BisContext.showToast(message, { durationMs?, imageUrl? })` queues temporary, context-local notifications. Text-only notifications need neither an account nor connectivity.
- One toast enters from the top, holds for 3000 ms by default, and exits above the same clipping boundary. Duplicate strings are separate entries. Callers can override duration.
- Optional artwork is decoded before entry, with a 3000 ms preparation deadline; missing, invalid, failed, stalled, or undecodable images fall back to text. A loaded image appears proportionally on the left. Trophy callers pass `result.asset.iconUrl` after their own confirmed result.
- The shared renderer remains outside inert account content, preserves focus and pointer interaction, supports reduced motion, and cancels callbacks on teardown.
- D. UI / D1 Show Toast uses this public API. E. Admin Tools contains E1 Fund Signet Sats and E2 Open On Mempool.space with their existing callbacks and guards.
- The document's former D stories remain X1-X6 in the appendix. C6 trophy awarding is still a separate draft; the image fixture displays artwork without minting a trophy.

## Automated checks

- Queue/playback and optional-image tests: 9 passing tests covering defaults/overrides, literal text, duplicate FIFO entries, independent contexts, no wallet work, pre-mount delivery, navigation, disposal, timer cancellation, image preparation/decoding failure/timeout, and late image callbacks.
- Admin tests cover exact D1/E1/E2 labels, callback routing, and independent availability, including Account-open and logged-out guards.
- The Receive rendering fixture now creates its context and UI through the same Vite module graph; this preserves its existing assertions while using the same private controls registry.
- Full-suite, build, and final OpenSpec results are recorded below after the final run.

## Browser evidence

Production demo and independent public host were exercised through Playwright. A headed browser was used for visual inspection; final motion sampling also ran headless to avoid Windows occlusion pausing compositor animation. Final verification used a local Vite server on port 5182 with HMR disabled, preventing concurrent source edits from interrupting measurements. The regular local development preview is on port 5180; port 5175 belongs to the separate game.

- Real D1 button: exact test message, no Account navigation, three repeated clicks yielded three sequential notifications. Observed fully visible holds were approximately 3003-3015 ms, with separate entry and exit phases.
- Runtime scales 100%, 50%, and 25%: card containment, wrapping, and complete disappearance passed. Account-open D1 remained available. Logged-out E1/E2 stayed disabled.
- Narrow 390px demo: scroll from Admin to Preview recomputes nonzero visible runtime bounds. This exposed and fixed a missing scroll listener in the shared visible-viewport hook.
- Motion geometry: the card's bottom was approximately 35px above the clipping top at both entry start and exit end; 204 timed geometry samples confirmed the full down/up path in an unoccluded browser.
- Independent host: a 5000 ms override held for approximately 5016 ms. Literal markup remained text, wrapping stayed inside the narrow host, and the underlying Host action retained pointer interaction and focus.
- Pending/error coexistence: toast and live announcement remained outside inert content; dialog focus was unchanged and an error still required OK after the toast expired.
- Reduced motion: no movement phases, two repeated messages retained FIFO holds, and the live region updated text / empty / same text separately.
- Cleanup: unmount removed the current toast and backlog; explicit later submissions waited for remount. Disposal prevented delivery. StrictMode replay displayed a pre-mount message once.
- Image preview: the existing `assets/achievements/v2/level-1-trophy.png` loaded and appeared left of the text with `object-fit: contain`. Broken images fell back to text. A deliberately stalled image fell back after the bounded wait and released the next queued message. Unmount during image loading did not revive a message after the request completed.

Local screenshots and diagnostic scripts are in ignored `output/playwright/`, including `toast-demo-100.png`, `toast-demo-0.5.png`, `toast-demo-0.25.png`, `toast-demo-account.png`, `toast-demo-mobile.png`, `toast-independent-narrow.png`, and `toast-trophy.png`.

Accessibility verification inspected DOM live-region updates, focus, and reduced-motion behavior. A spoken screen-reader session and physical Android/iOS devices were not tested. Deliberate broken/stalled-image fixtures produced expected network errors; the regular demo also has an unrelated missing favicon.

## Final results

- `npm test`: 257 tests passed, zero failed.
- `npm run build`: passed, including TypeScript checking. A transient error in concurrently edited asset-collection code disappeared after that edit settled; no unrelated fix was made here. Vite reports its existing large-chunk advisory.
- `openspec validate add-d7-toast-messaging --strict`: valid.
- D2 Show Toast With Icon: real Admin browser check passed with loaded trophy artwork geometrically left of the sample text; D1 remained text-only. Screenshot: `output/playwright/toast-admin-icon.png`. Admin unit tests cover D2 routing and independent availability alongside D1.
