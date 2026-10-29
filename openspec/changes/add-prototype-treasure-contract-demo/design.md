# Design

## Finite completion and release order

This change is a required part of the user's nine-step release. The coordinator owns Sandbox-only files; shared integration changes belong to the BIS owner. Preserve the existing direct SDK requirement, Setup Wallet 2 and all unrelated work.

1. Freeze the actual supported contract mode, compiled script, wallet binding, exact Create/Check/Claim/Reject expectations, recovery format and feasible test budget. Reuse reviewed contract construction/validation only after confirming it works with a direct SDK wallet; do not instantiate a BIS Account/service or clone game UI.
2. Implement explicit Create of one real 1,000-sat offer with the original 90-second deadline and durable protected recovery. Query the original contract before writes and prevent duplicate creation after unknown results.
3. Implement Check from current operator/transaction evidence, then Claim and Reject against the same original contract. Verify exact source/output/amount/asset/fee evidence before a terminal result. Exercise expiry/refund and reload/lost-ack preservation.
4. Vet all four routes and visible executable source together. Each shared Execute/network control stays clickable and returns an accurate result. Keep source in Arrange/Act/Assert order, mask wallet inputs and preserve Conditional Vault navigation.
5. Run meaningful focused tests/types/build, real funded Signet/Mutinynet lifecycle cases only with an assigned admissible slot, and Edge/managed-browser page verification. Deterministic fixtures are not live receipts.
6. Ship with the same final BIS candidate, verify all four public pages and exact release identity, and close step 9 only when the complete lifecycle passes. An unsupported or unimplemented contract action remains a blocker, not completion.

The historical supplied Setup wallet has unresolved operations on both networks. Preserve those records and their exact affected scope. Do not use the same reserved inputs for a new offer or erase recovery. An unrelated eligible registered test identity can be used in an isolated protected acceptance profile without overwriting the user's stored wallet data; its exact source and receipts must be recorded privately/safely.

## Context

See proposal.md for motivation and `specs/prototype-treasure-contract-demo/spec.md` for behavior. The sandbox routes demos through `navigation.ts`, `demo-files.ts`, `demo-registry.ts`, and `App.tsx`; Conditional Vault supplies the nearest smart-contract presentation pattern. The game-side treasure runtime provides contract and recovery behavior to adapt for direct SDK use in the sandbox.

## Goals / Non-Goals

**Goals:**

- Present a compact Treasure Hunt lifecycle beside Conditional Vault using the Arkade SDK.
- Bind every action to the selected network and Setup Wallet 2; verify contract state against the operator.
- Preserve the sandbox's overview, source, diagram, route, and documentation conventions.
- Keep secrets out of demo state and distinguish pending or uncertain outcomes from verified completion.

**Non-Goals:**

- Porting the game's chest, collision, pause, sound, or gameplay-session code into the sandbox.
- Copying game-only session and presentation behavior into the sandbox.
- Treating a public address as a BIS Player profile or inferring success from browser storage.
- Claiming live network qualification based on deterministic tests or the game WIP alone.

## Decisions

1. **Use the Arkade SDK directly.** Adapt the production treasure contract and recovery rules to the prototype's SDK wallet workflow. Do not create a BIS Account or use the BIS service.

2. **Use Setup Wallet 2.** Each action opens the selected network's wallet with the same SDK helper as the other demos. A separate Player profile or Account login is not required. Preserve pending-operation journals and use network evidence for contract outcomes.

3. **Keep one lifecycle across the Treasure Hunt routes.** Provide Start, Check, Claim, and Reject steps beside each other in navigation. Every page uses the standard Execute/network button and remains clickable regardless of browser-side offer or wallet state. Query the operator and verify the original contract and transaction evidence before displaying or spending. Durable recovery records retain original intent but are not network evidence.

4. **Make every write explicit and uncertain results stable.** Start occurs only after a click and first checks for an unresolved matching offer. Claim and Reject each query state again before targeting the current matching contract. Pending, unavailable, or unknown results remain visible in BIS contract state; a reload or repeated render cannot create a replacement or retry a financial action.

5. **Describe network guarantees accurately.** Disclose the selected network's actual contract mode and limitations; do not place it in Input, silently fall back, or change networks. Keep Signet and Mutinynet claims separate and limited to modes actually implemented and verified.

6. **Keep source panels executable and teachable.** The displayed Treasure Hunt demo source contains exactly `// Arrange`, `// Act`, and `// Assert` sections in that order. Within Arrange, imports precede a blank line; if there are localStorage reads they follow, then remaining setup follows another blank line. Treasure Hunt does not need demo-owned local session reads.

## Risks / Trade-offs

- [Risk] Setup Wallet 2 may be unavailable on the selected network. → Open it through the shared demo wallet helper and fail closed before contract requests if verification fails.
- [Risk] The game-side treasure work and package export may change while this feature is implemented. → Verify against the current integration public API and capability results at implementation time; do not depend on an unverified game artifact or copy unstable internals.
- [Risk] A provider timeout can leave funding or a spend unresolved. → Keep the original session binding and expose explicit Check/reconciliation; never infer failure or automatically replace the request.
- [Risk] Current network support may differ by contract mode. → Gate Start from live BIS capability and disclose the actual mode for each supported network.

## Resolved setup

Use Setup Wallet 2 through the standard direct SDK helper, without a separate BIS Player Account prompt or a validation-mode input. Disclose the actual network-default contract guarantees outside Input. Same-wallet sandbox roles are allowed; this does not change the main game’s distinct-role contract.
