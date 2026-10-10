# Design

## Context

See `proposal.md` for the user-facing motivation. The onboarding component already receives the current `OnboardingView` and fresh `BisBalance`, and `onboardingReadiness` already projects the strongest active-account evidence to stage 5. The shared account shell separately derives a generic balance failure from `state.balance.status === 'unavailable'`, which can appear while onboarding is still rendering its own progress.

## Goals / Non-Goals

**Goals:**

- Make the introductory onboarding copy reflect the same readiness projection used by the five stages.
- Preserve the requested line break between the two incomplete-state sentences.
- Keep completed accounts from being told to fund again.
- Keep temporary balance-read unavailability from producing an unrelated global error on the onboarding route.
- Add deterministic regression coverage for both message states and the transient error condition.

**Non-Goals:**

- Do not change onboarding allocation, settlement, recovery, polling, or completion rules.
- Do not add a cached or stale balance fallback.
- Do not suppress genuine onboarding operation failures or balance errors on Account Details, Swap, or other account views.
- Do not change public integration APIs or persistence formats.

## Decisions

1. **Derive the header from `onboardingReadiness`.**
   The component will use the existing readiness result rather than duplicating record or balance checks. Stage 5 / `Complete` selects the completion copy; every other state selects the incomplete copy. This keeps copy and stage presentation synchronized. An independent boolean based only on the durable record was considered, but would regress the already-supported fresh-positive-Arkade-balance presentation.

2. **Represent the cosmetic break as two rendered text nodes or an explicit line break.**
   The incomplete copy will preserve the exact two sentences and a visible newline between them. CSS-only wrapping is not sufficient because it does not guarantee the requested sentence boundary across widths.

3. **Scope error suppression to the onboarding view.**
   The shared shell will distinguish the onboarding route before generating the generic balance-load failure, while all other balance-consuming account views retain their existing error behavior. This avoids changing the underlying balance state or hiding real errors from pages where balance data is the primary content.

4. **Test at the UI boundary with existing fixtures.**
   Extend the existing onboarding host or focused UI tests to assert the exact incomplete and complete messages, line-break structure, and absence of the generic balance error when the balance is temporarily unavailable. This is preferred over testing only string helpers because the bug involves coordination between onboarding rendering and the shared notice.

## Risks / Trade-offs

- [Risk] A balance read may be unavailable while onboarding has not yet produced independent evidence. → Keep the onboarding loading surface and its own status intact; suppress only the generic shared balance sentence, not onboarding progress or actual operation errors.
- [Risk] Existing working-tree edits overlap the target onboarding and loading files. → During implementation, preserve unrelated changes and add tests against the current APIs rather than reverting or broadening the refactor.
- [Trade-off] The completion copy may appear while the durable onboarding record is absent if fresh positive Arkade balance evidence proves readiness. → This is intentional and matches the existing stage-5 presentation contract; it does not create transfer history or alter reservations.

## Migration Plan

No data migration is required. Implement the presentation and test changes, run the focused integration/admin tests and relevant typecheck/build checks, then deploy with the existing frontend bundle. Rollback is a code-only revert of the presentation and test changes.
