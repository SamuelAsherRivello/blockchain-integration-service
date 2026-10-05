## Context

The Contracts account page is a React UI over the existing `BisContext.checkContracts` API. The API already supports filtered reads through `includeResolved`; host gameplay can keep using active-only queries while Account Contracts requests the complete account ledger. The contract projection is sanitized before it reaches the UI.

## Goals / Non-Goals

**Goals:**

- Make Account Contracts show terminal claimed/refunded records as inspectable ledger entries.
- Preserve the existing detail page and production Claim, Reject and Refund action guards.
- Keep the row layout consistent with Assets and Transactions by using the shared collection list shell.

**Non-Goals:**

- No new contract storage shape, signing path, Arkade call, or provider capability.
- No change to host/game filtering for matching only actionable session contracts.
- No attempt to fabricate live Signet evidence beyond the existing sanitized contract records.

## Decisions

Use `checkContracts({includeResolved:true})` from the account page. This keeps the complete-ledger behavior scoped to Account Contracts and avoids changing host controllers that rely on unresolved filtering.

Render the unselected Contracts page with `ItemList`, and reserve `ItemListDetail` for an opened contract. This preserves shared fixed list sizing and row styling instead of manually nesting a list inside the detail scroll area.

Rename the known-empty state to `No contracts.`. The previous active-only wording was misleading after the page became a complete account ledger.

## Risks / Trade-offs

Terminal rows may grow over time. The existing list scroll area and copyable report mitigate this for the current local demo scope; longer-term pagination can remain separate.

Resolved records are inspectable but not actionable. Existing `canClaim`, `canReject` and `canRefund` guards remain authoritative for detail actions.
