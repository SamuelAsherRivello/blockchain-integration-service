# Design

## Context

The production account client renders Developer and Onboarding as nested presentations while the shared context owns Account Details and onboarding route flags. The current implementation has a local `developerReturn` marker, but the Back handler invokes the context transition and local Developer transition together, making the intended immediate-parent route vulnerable to ordering and stale-state behavior. See `proposal.md` for the user-visible motivation and `specs/account-entry/spec.md` for the navigation contract.

## Goals / Non-Goals

**Goals:**

- Represent the onboarding parent route explicitly enough that Developer-origin onboarding reliably returns to Developer.
- Keep context route flags and local presentation state consistent after both Back actions.
- Preserve the existing Balance-origin onboarding return path.
- Add a regression test for the complete round trip.

**Non-Goals:**

- No changes to onboarding assessment, wallet operations, balances, storage, or public API shape.
- No changes to Admin E3 beyond preserving its existing onboarding entry behavior.

## Decisions

- Use the existing production UI route state as the source of truth and make the parent-route transition atomic from the Back handler. This keeps the fix local to navigation and avoids adding a second navigation stack.
- Treat Developer-origin onboarding and Balance-origin onboarding as distinct parent cases. A generic `closeAccount()` remains appropriate for Balance, while the Developer case must first leave onboarding and then reveal Developer only after the context is no longer rendering onboarding.
- Extend the existing onboarding host regression rather than introducing a new harness. The test already exercises Developer → Onboarding → Back and can assert the visible title/actions and the subsequent Developer Back destination.
- Do not modify the context API. The route is an internal presentation concern, and changing the public interface would expand the compatibility surface without improving the user-visible contract.

## Risks / Trade-offs

- [Risk] A state update may render one intermediate frame of Account Details while returning to Developer. → [Mitigation] Apply the route transition in one event and assert the final rendered title/actions in the regression test.
- [Risk] A broader Back refactor could affect other nested account pages. → [Mitigation] Limit the change to the onboarding parent marker and cover both Developer-origin and Balance-origin paths.
