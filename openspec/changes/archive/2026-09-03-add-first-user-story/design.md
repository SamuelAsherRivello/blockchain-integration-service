## Context

See proposal.md for the confirmed scope. The original GameOverlay-only entry has been replaced in the demo by explicit public context and UI factories. The game can mount BIS without rendering React itself; GameOverlay remains a compatibility wrapper.

## Goals / Non-Goals

Goals: one production implementation, explicit instance ownership, lean observable state, independently scoped styling, and a small demo that can be exercised immediately after implementation.

Non-goals: wallet setup, persistence design, A4 account-menu implementation, game settings simulation, automatic capability discovery, and arbitrary admin state mutation.

## Decisions

### Public contexts and mounted UI

```javascript
const context = createBisContext();
const adminContext = createBisAdminContext(context);
const ui = createBisUi(context);
ui.mount(container); // empty initially
ui.showAccountButton(); // explicit host presentation request
context.openAccountDialog(); // alternatively call directly, without showAccountButton()
ui.unmount();
context.dispose();
```

React stays inside integration. UI owns its React root and cleans it up on unmount. The host owns the container and the instance lifetime. Mounting an already-mounted handle must not create duplicate roots; mounting to another container requires unmount first. Keep the existing GameOverlay export as a compatibility wrapper, delegating to the same production components rather than duplicating behavior. The new demo uses only the factories and public stylesheet.

Use a minimal immutable snapshot and subscription on context: getState() and subscribe(listener), returning an unsubscribe function. State exposes account-view visibility and non-secret profile presence only as needed by runtime behavior. No SDK objects or secret material. The Admin UI consumes this production surface first; no generic capability introspection.

createBisAdminContext(context) supplies only a concrete transient reset operation for this slice, resetClient(). It releases/reset transient service state without clearing persistence; the demo then unmounts/disposes the old instance and rebuilds context, adminContext, and ui. The old admin context becomes unusable with its disposed context. This separates privileged development intent from production calls without introducing general-purpose setters. No test-account injection in the running app.

### Presentation and state

Demo selection is independent of integration state. Initially neither a story nor runtime content is selected. Selecting A1, labeled Account Button, calls ui.showAccountButton(). Clicking the production button replaces it with the no-profile dialogue. Create Account and Restore Account retain lightning prefixes and are disabled. Call this the Account dialogue. Show the Account title, then current-state body text: "You are not logged in." Remove the decorative top icon and all coming-soon explanations. Create Account is primary with a stronger green fill while disabled. Restore Account and Back are secondary; all three have equal width and padding. Disabled controls keep the prohibited cursor. Back has no lightning icon.

The Account dialogue has Back, which returns to its prior presentation (Account button when opened from that button, empty when opened from an empty layer). Do not introduce Escape or backdrop dismissal. The chooser blocks pointer/game input only within the mount region; the Admin UI remains usable. Keep focus behavior accessible without a document-wide modal or focus trap that prevents visiting Admin UI controls. Restore focus to the Account button when available.

Repeated account-open requests are idempotent. While Account is open, disable the Admin UI story action using the context subscription. Reset Client remains available after selection and clears that selection. Reset with no selection is disabled. Reset reconstructs all three handles and leaves runtime content empty, without touching local storage.

### Independent story boundary

A1 is fully defined by the no-profile Account button, Account dialogue, and Back flow. Active-profile opening is owned by the separate planned A4 story. The internal routing helper and tests are preparatory only; there is no live profile creation or injection. A2/A3 implement real creation/restoration later. Their absence does not make A1 partial.

### Ownership and styles

Integration core owns state/lifecycle; integration UI owns production components, centering within its mount region, a content-sized entry button, equal-width dialogue buttons, and light styling. The Arkade layer is untouched. Demo owns the dark page, category/story navigation, preview frame, placeholder, selection, and reconstruction orchestration. Its single 9:16 presentation layer has no substitute game UI.

Use scoped class names and integration-owned visual tokens, including explicit typography, colors, and button styles. Avoid global demo element selectors leaking into BIS. Verify production UI in a plain host without demo styles. Future multi-container placement is deferred; no absolute viewport coordinates are embedded in the Account button.

### Demo layout and scale

Header: Blockchain Integration Service - Demo, version prefixed with v, and a GitHub repository icon/link. Panel headings are Admin and Runtime Preview in matching typography. Admin contains User Stories (H2), Documentation link, then Account (H3) and Account Button; no Interactivity heading. The Markdown URL is bundled using Vite so the same link works after build.

Preview scale options are 100%, 50% (default), and 25%. A demo-owned wrapper uses inverse percentage width/height and a top-left CSS transform. The outer portrait frame stays fixed; changing scale preserves the mounted BIS UI and state. Reset clears runtime state and selection, not the display-scale preference. A centered Game Viewport placeholder is visible only while the runtime layer is empty.

### Documentation and availability

Maintain a small explicit demo story catalog with stable document IDs, label, category, and presentation action. Only implemented demonstrations enter the catalog. A1's Account Button demonstration covers the complete no-profile diagram. A4 separately owns the active-profile diagram.

Keep documentation/User Story Diagrams.md in place to preserve links. Retain the complete flows and add accurate current-implementation notes/status mapping. Update boundary/design notes and relevant READMEs to describe the public factories and style ownership. Future feature completion requires a corresponding admin demonstration and updated story documentation; no Markdown parsing or generated catalog pipeline is needed now.

## Risks / Trade-offs

- Story scope drifts into adjacent flows -> preserve the explicit A1/A2/A3/A4 boundaries and keep each diagram independently completable.
- Global native dialogs can block Admin UI -> use container-local production presentation and verify pointer/keyboard access.
- Recreated contexts can leave stale subscriptions -> own cleanup explicitly and verify repeated reset/unmount behavior.
- Two state owners can drift -> integration owns runtime truth; demo owns selection only.
- Light UI inherits dark host CSS -> scope selectors and inspect in two hosts.

## Migration Plan

Add factories and shared production components, migrate the demo to them, replace admin content, then update documentation and verify in browser. Do not edit generated dist files. No data migration is needed. If a correction is needed, make an additive follow-up change; do not discard unrelated work or rewrite Git history.


