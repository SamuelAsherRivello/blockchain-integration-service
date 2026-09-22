# Proposal

## Why

The current A-H/X lettering reflects the order in which features were added rather than the product's durable domains. Player Wallet work is now the majority of the product, while Game Wallet work is a smaller but distinct responsibility; the current numbering hides that distinction and leaves migrated stories, Admin-only controls, and newer wallet work inconsistently placed.

Now that the account, payment, asset, game-wallet, and Admin surfaces have been implemented far enough to expose their real boundaries, the user-story catalog should be renumbered from scratch around stable domains with explicit `P` and `G` lanes for Player Wallet and Game Wallet ownership.

## What Changes

- **BREAKING** Renumber the user-story catalog from scratch under these stable domains:
  - `A` Accounts
  - `B` Payments/Transfers
  - `C` Assets
  - `D` Contracts
  - `E` Transactions
  - `F` Integrations
  - `X` Appendix
- Add explicit `P` and `G` subsections under each applicable domain, where `P` means Player Wallet and `G` means Game Wallet. Use `P/G` for shared behavior and `--` for work that is neither wallet-specific.
- Reassign all current stories to the new domain/lane catalog, including account lifecycle, payments/transfers, assets, contracts, transactions, integrations, game-wallet work, Admin tools, and spikes under `X Appendix`.
- Place `P` and `G` lanes under each applicable domain: `P` for Player Wallet, `G` for Game Wallet, and `P/G` for behavior shared by both.
- Move deferred Lightning receiving/sending into `B. Payments/Transfers`, move Game Wallet security and reliable Game Wallet onboarding/transfer recovery into the `A.G` lane, and add `F. Integrations` for shared UI and onboarding integration stories.
- Move the current Admin presentation to match the new domain hierarchy, with Player Wallet and Game Wallet responsibilities visibly distinguishable.
- Update the user-story table of contents, headings, story table, Admin labels, documentation links, cross-references, and diagram step references to use the new IDs.
- Preserve historical OpenSpec change directory names, archived evidence paths, API identifiers, transaction records, and implementation history even when their old story labels are superseded.
- Maintain a compatibility cross-reference from every former ID to its new ID so historical implementation evidence remains traceable.
- Preserve truthful completion states; renumbering SHALL NOT turn partial, blocked, deferred, or live-pending work into completed work.

## Capabilities

### New Capabilities

None. This change reorganizes the existing story catalog and its Admin/documentation presentation.

### Modified Capabilities

- `story-driven-demo`: Change the required six-domain taxonomy, Player/Game Wallet lane labels, Admin story organization, documentation synchronization, stable-ID policy, and historical cross-reference behavior.

## Impact

- `BIS/documentation/User Story Diagrams.md` and any generated or published user-story documentation.
- `BIS/packages/integration-demo/src/admin/AdminPanel.tsx` and related Admin story-selection, labels, and navigation code.
- Admin and documentation tests that assert story IDs, labels, category order, or links.
- OpenSpec requirements and future implementation task references that currently name A-H/X story IDs.
- No wallet protocol, public integration API, transaction behavior, asset metadata, or persistence format should change as part of the renumbering.
