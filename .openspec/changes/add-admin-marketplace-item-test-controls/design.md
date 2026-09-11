## Context

See [proposal.md](proposal.md) for motivation. The integration package currently exposes generic mint/list/burn operations. `createBisGameWallet` provides the separately retained Game Wallet and `createBisContext` owns the Player Wallet. The Admin Marketplace panel has batch H1 mint and H2 Game-Wallet burn controls, while the standalone Marketplace correctly exposes an unavailable atomic-exchange gate.

Arkade SDK 0.4.71 supports an asset-bearing `Wallet.send` recipient: the recipient declares exact assets, and any unallocated selected assets must be returned in sender change. Arkade assets must ride a sats-carrying output, so a transfer cannot claim a literal zero-value protocol output. This change treats the carrier as a protocol requirement, not a buy/sell price or a sats payment.

## Goals / Non-Goals

**Goals:**

- Make the real Signet Game-Wallet-to-Player-Wallet equipment path testable by exact asset ID and quantity.
- Make Player-owned test-item cleanup deliberate, scoped, recoverable, and independently usable from unrelated UI.
- Preserve public, JSON-safe, UI-independent integration boundaries and existing wallet-role separation.

**Non-Goals:**

- A production purchase, sell-back, listing, price settlement, player-to-player market, or atomic-exchange implementation.
- Any recovery-phrase, signing-key, custom-server, or cross-repository game-runtime work.
- A claim that chain carrier sats are a zero-value transfer or a Marketplace payment.

## Decisions

### Add a dedicated exact-asset-delivery operation

Add core request/result/validation and durable journal types parallel to mint and burn, then expose `deliverAsset` on the Player context and Game Wallet controller. The Arkade adapter will use the installed SDK's asset-bearing send path with a single recipient allocation for the requested asset and quantity, constrained selected inputs, exact transaction-shape inspection, and an explicit change allocation for remaining assets.

This keeps Arkade SDK types behind the adapter and lets both demo roles use one public boundary. Reusing the existing sats-only `send` boundary was rejected because its inspection contract deliberately preserves all assets in sender change and cannot express an exact asset recipient allocation. Calling SDK methods directly from the Admin panel was rejected because it would duplicate secret-bearing wallet creation and bypass durable recovery.

### Persist intent and reconcile from output evidence

The delivery journal will bind operation ID, sender profile, recipient Arkade address, asset ID, quantity, selected input outpoints, expected recipient script, expected sender change, and transaction ID once known. The write must occur before the provider submission boundary. Reconciliation will query fresh Arkade/Indexer data and require the expected recipient output with the exact asset allocation; a missing sender holding alone is never success evidence.

This follows the existing burn/send reservation model, avoids automatic retry, and allows a later explicit reconciliation action. Treating a synchronous SDK transaction ID as final ownership proof was rejected because an acknowledgement can be lost or final output observation can be unavailable.

### Build one-item Admin controls atop fresh role-scoped reads

`MarketplacePanel` will keep only a selected asset identity as UI state. A fresh Game Wallet listing creates the eligible selector and rechecks that item immediately before delivery. After the send, a fresh Player Wallet listing drives whether the exact item is eligible for the separate Burn Item from Player control. The Player burn reuses the existing guarded burn boundary only after its existing explicit confirmation flow has been shown.

The panel will receive the Player context explicitly from `App`, alongside the Game Wallet controller. It will compare profile IDs and public addresses before each operation, prevent same-identity use, and invalidate selection/late results when either role changes. This reuses ownership classifiers rather than names, local catalog mappings, or stale batch records.

### Scope pending UI by operation and asset, not by the panel

The panel will record pending state using an operation key including direction and exact asset ID. A pending key disables only the duplicate/conflicting action for that asset and presents a truthful pending/unknown result with reconciliation. Other navigation, wallet inspection, and independently safe item controls remain interactive. Existing per-wallet mutation and durable input-reservation protections remain the final concurrency authority; UI enablement does not promise a disjoint wallet mutation can always submit.

A single `busy` flag was rejected because it blocks the user's unrelated behavior while a network result is pending. A fire-and-forget button was rejected because it loses the source identity, exact quantity, and recovery evidence required to avoid duplicate delivery.

### Keep Admin delivery separate from Marketplace trading

The Admin panel will label this as test setup/cleanup and will neither render nor call the standalone Marketplace trading path. Marketplace gate tests will remain explicit: the only allowed Buy/Sell state without a demonstrated atomic primitive is unavailable. No ordered payment-plus-asset fallback will be introduced.

## Risks / Trade-offs

- [An Arkade asset output carries required sats] → Present it as an implementation carrier rather than a price, verify its exact transaction shape, and avoid a misleading literal-zero-sats assertion.
- [A provider acknowledgement is lost] → Persist before submit, reserve exact inputs, return pending/unknown, and reconcile using recipient output evidence before success.
- [Player or Game Wallet changes during a slow read] → Bind each operation to profile/address snapshots and reject late work before submission or presentation.
- [Browser-local journals can be cleared] → Do not infer completion from local state; fresh chain evidence remains authoritative and the UI reports unavailable/recovery when safe reconciliation data is absent.
- [Existing unrelated local edits are present] → Limit implementation and tests to the new asset-delivery and Admin-control files; do not fold concurrent account-recovery or Marketplace styling work into this change.

## Migration Plan

1. Add the public delivery boundary, durable journal/reservations, and adapter tests before wiring any Admin button.
2. Add the Admin selector, two controls, confirmation, and focused UI/browser tests.
3. Run package and workspace verification, then use the two controls with already logged-in distinct wallets for live Signet evidence without recording secrets.
4. Rollback is additive: omit the new Admin controls and public delivery entry from a later build. Existing mint, list, burn, Marketplace catalog, and atomic gate records remain unchanged.
