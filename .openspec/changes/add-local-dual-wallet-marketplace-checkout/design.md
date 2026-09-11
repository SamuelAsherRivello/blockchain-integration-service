## Context

See [proposal.md](proposal.md) for motivation. The Marketplace already obtains anonymous live inventory from a registered Game Wallet address and classifies equipment from chain metadata. `catalog.json` currently duplicates per-item records and the Admin development server mutates that file after H1. The Marketplace detail always reads the unavailable atomic-exchange gate.

The integration package already has durable, input-reserving journals for sends, mints, burns, and the partial `asset-delivery` foundation. Player and Game Wallet controllers create their signers locally from their own persisted account state. The generic send implementation deliberately preserves all assets in sender change; it cannot deliver a selected item. No remote service is permitted.

## Goals / Non-Goals

**Goals:**

- Preserve `catalog.json` as the public, deployable trust anchor while reducing it to the official Game Wallet address and game ID.
- Derive current marketplace availability entirely from fresh public inventory and chain classification.
- Support Buy and Sell only when one browser holds distinct local Player and Game Wallet sessions, with truthful two-step recovery.
- Keep unrelated Marketplace interaction responsive while one exact checkout is unresolved.
- Reuse the existing Account UI rather than adding another credential route.

**Non-Goals:**

- Atomic exchange, remote checkout, a hosted seller, a solver, background monitoring, or sharing the Game Wallet's recovery phrase.
- A player-to-player market, dynamic global publisher registration, or automatic GitHub Pages deployment after an Admin mint.
- Changes to the separate game repository. This change supplies and verifies the BIS loadout state the game consumes.

## Decisions

### Keep a minimal static publisher configuration

`catalog.json` remains the stable public URL but becomes a versioned publisher configuration containing only `gameId` and `gameWalletAddress`. The Marketplace uses the address to query the Signet indexer, then takes item identity, price, effect, artwork, and availability from fresh chain data. Keeping this small static trust anchor avoids a server and prevents arbitrary wallet addresses from impersonating the official seller.

The Admin H1 workflow will mint and verify inventory only. It will no longer POST a per-item catalog update to the local Vite middleware. Requiring a GitHub Pages release merely to add an item was rejected because it duplicates chain inventory and does not meet the desired live-listing behavior.

### Add exact asset delivery beside generic sending

The delivery adapter will create a temporary local signer, read current asset-bearing inputs, bind an operation record before submission, and submit one recipient allocation for the exact requested asset quantity. It will inspect the prepared transaction's recipient allocation and sender change, then reconcile against fresh source and recipient inventory. It will be exposed by both the Player context and Game Wallet controller without SDK types or secrets.

Reusing generic sats sending was rejected: its deliberate asset-preservation contract returns every asset to sender change. Direct UI SDK use was rejected because it bypasses durable recovery and duplicates wallet authority handling.

### Coordinate two durable legs in a checkout journal

A Marketplace checkout record owns the user-visible operation state and links to the underlying durable sats-send and exact-asset-delivery operations. It records direction, both profile IDs and addresses, exact asset/quantity, price, and phase before the first submission. A purchase advances only through Player-to-Game payment confirmation and then Game-to-Player delivery confirmation; sell-back uses the inverse asset-first order.

Reconciliation repeats fresh read-only evidence and advances only a demonstrated phase. A payment or delivery that may have crossed the submission boundary remains pending; retries reuse the same operation identifiers. The POC label is visible because the two legs are not atomic. A shared browser mutation lock serializes signing, while item-level checkout reservations prevent conflicts without disabling unrelated cards or wallet inspection.

### Use the existing Account entry point for both wallet roles

The left sidebar will show concise Player Wallet and Game Wallet status, then an instruction section. `Enable Item Listing` is visibly enabled by default. Selecting `Enable Item Sales` reveals the required Account path rather than a duplicate login UI: the upper-right Account button creates or restores the Player Wallet, then Account → Developer → Game Wallet Login creates or restores the distinct Game Wallet. Until eligibility is complete, the item detail displays exactly `Buying and selling are not enabled. Follow the instructions in the left sidebar.`

### Preserve the game boundary

After a confirmed purchase, the Marketplace refreshes Player asset and equipment state. The existing public equipment API remains the game-facing contract; it carries selected, currently owned equipment without Arkade types. The separate game repository must verify activation and gameplay impact against that API; no game-runtime source is added to this workspace.

## Risks / Trade-offs

- [Two transfers are not atomic] → The UI labels the POC accurately, records both legs before submission, blocks conflicting actions, and provides reconciliation rather than fabricated completion.
- [The wrong local Game Wallet is selected] → Freshly bind both identities and inventory to the operation; label the session override and reject changed sessions before submission.
- [Indexer acknowledgement is lost] → Preserve the underlying leg journal and require exact recipient/asset evidence before advancing.
- [A static publisher address changes] → Treat the configuration as release-time public trust data; update it only through the normal reviewed deployment workflow.
- [The game is a separate repository] → Verify BIS-owned player inventory and selections here; perform the gameplay-effect acceptance in that repository rather than claiming it from Marketplace tests.

## Migration Plan

1. Accept the existing deployed configuration while developing, then replace the checked-in configuration with the minimal publisher form.
2. Remove the Admin development-only catalog write endpoint after Marketplace no longer relies on per-item static records.
3. Existing asset, send, mint, and burn journals remain unchanged; new delivery and checkout records use distinct versioned keys and fail closed on unreadable state.
4. No release is part of this change. A later explicitly authorized Pages release publishes the new configuration format and UI.
