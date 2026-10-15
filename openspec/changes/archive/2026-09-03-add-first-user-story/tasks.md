## 1. Production context and lifecycle

- [x] 1.1 Add createBisContext with openAccountDialog, minimal immutable observable state, unsubscribe, and disposal; verify meaningful tests cover repeated opening and notification cleanup.
- [x] 1.2 Add internal profile routing and test both destinations with test-only inputs; verify runtime bundles expose no fake profile creation and documentation does not equate routing tests with A4 functionality.
- [x] 1.3 Add createBisAdminContext(context) with transient reset only; verify reset preserves persisted data and cannot mutate a disposed client.

## 2. Production UI

- [x] 2.1 Add createBisUi(context), mount, unmount, and showAccountButton using shared production components; verify initial empty rendering, optional button rendering, direct openAccountDialog without a button, and cleanup without duplicate roots.
- [x] 2.2 Implement Account button to Account dialogue to Back flow, with disabled Create Account and Restore Account; verify the real UI restores prior presentation and makes no wallet/network calls.
- [x] 2.3 Apply integration-owned light styles, centered content, a content-sized entry button, and equal-width dialogue controls; verify the UI visually in a plain host without demo CSS and ensure input blocking stays within the mount container.
- [x] 2.4 Expose factories through the package public entry point and reconcile the existing GameOverlay wrapper; verify package build and demo consumption without private imports.

## 3. Lean Admin UI and Runtime Preview UI

- [x] 3.1 Replace admin filler with an explicit implemented-story catalog containing Account / Account Button only; include User Stories / Documentation followed by Account, without Interactivity; verify empty categories and planned stories are absent and initial preview is empty.
- [x] 3.2 Mount the production UI in one preview container and wire selection to showAccountButton; verify clicks in Runtime Preview UI use the real production flow and Admin UI greys the story action while Account is open through production state updates.
- [x] 3.3 Wire Reset Client through admin reset and complete old-instance cleanup/recreation, clearing selection; verify resets return to an empty runtime layer, leave persistence untouched, and do not duplicate listeners.
- [x] 3.4 Scope dark demo styles to page/navigation/frame and remove redundant explanatory UI; include matching Admin/Runtime Preview titles, version/repository link, Game Viewport placeholder, and 100%/50%/25% scale; verify centering, preserved state on scale changes, and Admin UI input access while the dialogue is open.

## 4. Documentation and end-to-end verification

- [x] 4.1 Update User Story Diagrams.md with the complete no-profile A1 diagram, moving active-profile opening into A4; verify the implemented Account Button demonstration matches the entire A1 flow.
- [x] 4.2 Update relevant boundary/design documentation and package READMEs with the public factory example, styling ownership, and future feature/demo/docs synchronization rule; verify stale placeholder-only descriptions and broken links are resolved.
- [x] 4.3 Run the repository's build and relevant behavior tests, then exercise initial empty preview, story selection, Account, Back, and repeated Reset Client in a real browser; record outcomes and provide the running demo URL for the user to try.


## Verification results

- `npm run build`: passed, including TypeScript and both workspace builds.
- `node --test packages/integration/tests/context.test.mjs`: 3 passed.
- Real browser: initially empty, selection, production Account, disabled Create/Restore, Back restoring button, Admin UI disable/enable, keyboard Reset Client, repeated reset verified.
- Independent host `/tests/ui-host.html`: same light production UI without demo CSS; duplicate mount and unmount/remount exercised.
- Narrow frame `/tests/narrow-host.html`: 390px layout stacks and production chooser stays inside the portrait frame. Browser viewport override did not take effect, so a real narrow iframe was used instead.
- Fresh browser after lifecycle fix: no console errors. Demo URL: http://127.0.0.1:5174/ (5173 already occupied).
- A1 no-profile flow is complete; active-profile opening belongs to the separate planned A4 story.



Final A1 verification: the independently scoped no-profile flow passed in the real browser. Create/Restore are disabled; all three dialogue buttons have matching dimensions; Back restores Account and focus; Reset Client clears selection and runtime content. No console errors. Build, 3 core tests, and both spec validations passed. README and story index mark A1 complete.



