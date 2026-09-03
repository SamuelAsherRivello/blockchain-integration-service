# Design discussion

## Confirmed decisions

- Repository name: blockchain-integration-service (user decision, 2026-09-03).
- Source baseline: documentation/BGS_PROJECT_BRIEF.md, imported from the supplied Google Doc.
- Use OpenSpec and settle naming, folder structure, and integration contracts before implementation.
- Preserve the brief's separate game repository and frontend/core/Arkade responsibilities.
- Track planning files under `.openspec/`, with an ignored local `openspec` compatibility link for the stock CLI.
- Grill Me is optional and user-invoked before or after proposal creation. It is not a schema prerequisite; retain `spec-driven`.
- Approved: one integration package under `packages/integration`, with `core`, `ui`, and `arkade` internals; one consuming app under `packages/integration-demo`, with `admin` and `preview` folders.
- Initial baseline was a coming-soon Account overlay. The current account-entry implementation and public contract are described below; no Arkade integration yet.
- GitHub Pages publishes the demo app. Local development uses the React development server when needed.

## Questions for iteration

1. Retain Blockchain Gaming Services / BGS as product and API names, or align with Blockchain Integration Service?
2. Resolved: one integration package with explicit internal layers, consumed by the demo app.
3. Resolved: source under packages/integration/src and packages/integration-demo/src; docs under documentation. Test organization can grow with behavior.
4. Who mounts the React overlay and owns its container, styling, focus, resizing, and disposal?
5. Define initialization, availability, account lifecycle, request methods, events, and subscription cleanup.
6. When is connected mode fixed for a run? What happens after logout or account change?
7. How do operation/run IDs prevent duplicate charges and stale success events reviving the wrong checkpoint?
8. Who receives continue payments, creates payment requests without a custom server, and verifies completion?
9. Who issues achievements, funds issuance, defines asset identity, and handles duplicate claims and wallet restoration?
10. Verify current official Arkade Signet wallet, payment, asset, and recovery capabilities before implementation.

These questions and recommendations are not approved design decisions. The next outcome is a reviewed OpenSpec proposal, design, requirements, and tasks.

## Account entry implementation

- Production factories: `createBisContext()`, `createBisAdminContext(context)`, `createBisUi(context)`. UI exposes `mount(container)`, `showAccountButton()`, and `unmount()`; context exposes opening/closing, immutable state, subscriptions, and disposal.
- Runtime Preview UI consumes production API only. Admin UI consumes production state first and uses admin context only for transient reset. No private imports or security bypasses.
- Demo styles own the dark surrounding page/frame; integration styles own light centered production content. Hosts choose the mount container; future multi-container layouts are deferred.
- Admin shows implemented demonstrations and nonempty categories only. Initial selection is empty. Reset recreates clients, clears selected story, preserves persisted data, and leaves runtime content empty.
- A1 is complete: Account button > Account dialogue > Back, without a profile. A2 owns creation, A3 restoration, and A4 active-profile opening. Keep each story small enough to complete fully, then try it together and refine with hands-on feedback.
- New features must include an Admin UI demonstration and synchronized, accurate user-story documentation.




