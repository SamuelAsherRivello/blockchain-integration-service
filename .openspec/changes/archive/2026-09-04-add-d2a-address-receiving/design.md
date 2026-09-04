## Context

See proposal.md for motivation. The checkout already implements address loading in Core, AccountAddresses and AccountInvoice in production UI, immutable unavailable invoice capability, and focused address/invoice tests. The prior receiving change records real Signet address loading and partial browser verification; this is a reusable baseline, not proof of full D2a acceptance. Admin currently lists A1–A6 and opens the account dialog for non-A1 selections.

## Goals / Non-Goals

**Goals:** Deliver the D2a journey through the existing package boundary and verify parity without adding a second receiving implementation.

**Non-Goals:** New SDK/provider support, wallet transactions, invoice creation, persistent operation state, receipt supervision, Activity changes, or logout/reset changes. No dependency additions or data migrations.

## Decisions

### Reuse production behavior and fix only demonstrated gaps

Retain the existing address loader, navigation cancellation, Copy controls, and unavailable capability. Extend regression coverage before fixing any missing behavior exposed by D2a acceptance. Do not add a speculative amount state machine merely to store an unused zero; zero is the default contract for future amount entry, with no actionable amount input in D2a.

Alternative: rebuild Receive under a new D2a component. Rejected because the current production flow already supplies the intended baseline and a duplicate would diverge.

### Add a small explicit demo selection branch

Add D2a / Receive Funds under the existing Account category, preserving the story ID even though its grouping is Account. On selection use public methods to open Account, then Receive only if the current account is active. If logged out or not ready, retain the ordinary account flow; after manual creation/restoration the player uses the normal Receive button. Do not install a persistent auto-navigation intent or initiate account creation. Keep the demo's existing account-open selection policy.

Alternative: simulate an account or redirect automatically after creation. Rejected because demo behavior must reflect ordinary production entry and explicit player actions.

### Verify failures separately from real address evidence

Use isolated Core/UI tests for delayed reads, failed Refresh, clipboard denial, and stale results. Use a real Signet test account for browser address display and copying; no funding is required to demonstrate receiving instructions. Exercise the package's public API and production UI in a plain independent host as well as the demo. Keep test doubles out of the runtime catalog and never print recovery material.

Alternative: require funded payments for this story. Rejected because its atomic outcome is obtaining a correct receiving address, not proving settlement or introducing transaction processing.

### Track split ownership without erasing history

This change owns D2a completion. Link it from the D2a user-story status during implementation. Preserve the earlier receiving change's evidence and unfinished live tasks, and document that its shared presentation work is reused here. Do not check off its mixed live/demo tasks based on D2a alone. Later D2b planning/spec sync must reconcile overlapping baseline presentation requirements; this is not a prerequisite for shipping D2a.

Alternative: mark the earlier combined change complete. Rejected because that would hide missing live receiving and recovery work.

## Risks / Trade-offs

- Existing dirty demo/docs edits → Inspect current files and apply narrow changes without replacing unrelated content.
- Clipboard APIs differ by browser permissions → Verify both success and rejection, retaining manual selection fallback.
- Small preview height → Keep horizontal layout contained and Back keyboard-reachable; permit vertical scrolling.
- Prior test results drift → Re-run relevant tests and record dated evidence before checking acceptance tasks.
- D4 changes Receive concurrently → Preserve its separate transfer semantics and test the combined UI without absorbing D4 scope.

## Migration Plan

No persisted-data migration is needed. Add the demonstration and any test-proven UI fixes, then update documentation after verification. Rollback can remove the D2a catalog entry while preserving existing production Receive behavior and all account data. No account reset or destructive operation is part of rollout or verification.
