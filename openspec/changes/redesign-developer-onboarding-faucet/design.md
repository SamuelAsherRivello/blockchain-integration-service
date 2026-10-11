# Design

## Context

See `proposal.md` for motivation. Both standalone tools already have a dark, compact developer palette and real operational evidence. Onboarding is a long six-stage flow; Faucet currently groups health, addresses, balance, history, and request controls into two large panels.

## Goals / Non-Goals

**Goals:**

- Make the top-to-bottom order answer: where am I, what is happening, what do I do next, and where is the evidence?
- Preserve every existing control and state transition while reducing visual competition.
- Make optional data discoverable but closed by default when it is not needed for the next action.
- Keep keyboard-accessible native disclosures, responsive behavior, and reduced-motion support.

**Non-Goals:**

- No wallet, API, storage, timing, or settlement logic changes.
- No Admin or Marketplace changes in this slice.
- No new dependency or custom disclosure component.

## Decisions

1. **Use one shared runbook vocabulary, not a shared component package.**
   Onboarding and Faucet have different DOM and state models, so each keeps its existing markup while adopting the same visual tokens: eyebrow, title, environment badge, status line, action row, and `<details>` evidence foldout. A new shared package would add coupling for a visual-only change.

2. **Chronology is the primary layout axis.**
   Onboarding order is account -> fund -> observe -> onboard -> settle -> verify. Faucet order is network -> health -> request -> result. Balance and public identifiers move into compact summaries/foldouts where they support, rather than interrupt, the action sequence.

3. **Status remains always visible; evidence becomes optional.**
   The current state, owner, and next action stay in each stage header. Long transaction IDs, timing calculations, address lists, and diagnostic records use native disclosure sections with descriptive summaries. This preserves operational depth without forcing every reader through it.

4. **The first viewport is a control surface.**
   Both routes receive a compact header and a current-run summary before the detailed flow. The summary is not a second dashboard: it contains only environment, current status, and the next action/state.

5. **Use existing tokens and restrained accent colors.**
   Keep the dark navy/slate surfaces, pale mint success accent, warm pending accent, and red error accent already established by the developer surfaces. Typography and spacing are tightened instead of introducing decorative illustration or marketing language.

6. **Network selection belongs in the top bar.**
   Both prototypes expose the same compact `Network` control in the header. The Faucet clears its form and re-fetches operator data; Onboarding resets its scoped window and reloads with the selected network parameter, provider, explorer, and faucet configuration.

## Risks / Trade-offs

- [Risk] Moving evidence behind foldouts can hide important debugging context. -> Mitigation: keep state labels, last successful checkpoint, and public operation identifiers visible in the active stage; default only secondary detail closed.
- [Risk] Existing tests or selectors may rely on current panel grouping. -> Mitigation: preserve IDs, labels, controls, and state-bearing elements; add layout-only classes around them.
- [Risk] A denser first viewport can reduce readability on small screens. -> Mitigation: use one-column responsive rules, full-width actions, and retain native vertical flow below 540px.

## Migration Plan

1. Update the two route layouts/styles without changing operation modules.
2. Run package unit/smoke tests and inspect all four routes for cross-surface regressions.
3. If the design is accepted, extract the runbook tokens/pattern into a follow-up Admin refinement; this change deliberately leaves Admin untouched.
