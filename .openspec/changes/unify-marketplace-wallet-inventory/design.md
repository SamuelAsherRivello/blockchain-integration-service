## Context

See `proposal.md` for motivation. Marketplace currently converts both public game holdings and Player Wallet holdings through the equipment classifier. That classifier intentionally rejects trophy metadata because Account Assets and loadout treat trophies as inspectable non-equipment. Its reuse in Marketplace is therefore the immediate display defect, not a reason to weaken the equipment contract.

The public catalog contains a registered address that can become stale after an operator selects or mints to another Game Wallet. The current root development command starts the Admin Vite workspace only, while standalone Marketplace normally starts on a second Vite port. IndexedDB and other browser storage are origin-scoped, so ports cannot share persisted BIS wallet state.

## Goals / Non-Goals

**Goals:**

- Give Marketplace a verified presentation layer that can distinguish valid equipment from valid trophies without changing BIS equipment ownership or selection semantics.
- Attribute every rendered Marketplace holding to its actual game or player source and show truthful fresh, empty, and unreadable states.
- Make one local Vite server the supported way to exercise Admin and Marketplace together.
- Keep public catalog configuration and operator diagnostics limited to public address, network, and asset evidence.

**Non-Goals:**

- Implement an asset-for-sats exchange, player-to-player market, or trophy trading.
- Treat trophies as equipment, invent metadata from display names, or change game loadout behavior.
- Synchronize a static public catalog from the browser, expose wallet material, or add a hosted service.
- Replace the separate GitHub Pages `/admin/` and `/marketplace/` builds.

## Decisions

### 1. Add a Marketplace presentation classifier; retain the equipment classifier

Marketplace will map fresh `BisAsset` holdings into a discriminated presentation union. The equipment branch will continue to use `classifyBisEquipmentAsset`. A separate trophy branch will require verified Stealth & Steel game ID, `trophy` asset type, stable trophy catalog identity, supported tier/display metadata, and a valid runtime HTTPS icon. The raw asset ID and quantity remain part of both branches.

This preserves the existing shared equipment/loadout boundary: only the equipment branch can carry family, price, Buy/Sell eligibility, and a loadout selection. It also prevents a name or ticker from making an unrelated asset appear as a trophy.

Alternative considered: change `classifyBisEquipmentAsset` to return trophies. Rejected because its callers enforce equipment-only slots and would either gain invalid types or silently loosen the existing trophy safeguard.

### 2. Build one ownership snapshot per source, then filter presentation records

Marketplace will obtain two independent fresh snapshots: the active game inventory source and the active Player Wallet. The game source is the logged-in Marketplace Game Wallet public address when that role is active; otherwise it is the registered catalog address for the selected network. Player source reads remain tied to the active Player Wallet context. Each presentation record receives a source discriminator before the UI applies Owner, Game, and Type filters.

The UI will not merge or substitute results across sources. It will retain a per-source outcome (`ready`, `empty`, `unavailable`, or `unreadable`) so the empty state never claims that an unsuccessful lookup found no items. Type filters apply to equipment families only; trophies remain available from the all-types view.

Alternative considered: keep a single `ownedItems` collection and infer the owner after filtering. Rejected because the existing equipment state drops trophies before source attribution and cannot represent a source-specific failure truthfully.

### 3. Treat the public catalog address as a per-network trust anchor, not mutable browser state

The catalog will retain a public registered game address for each supported network and the app will label it as the registered source. A Marketplace Game Wallet login can override the active source only for that browser session and will be labelled accordingly. Admin H diagnostics will provide the selected network, current public Game Wallet address, and fresh recognized item evidence so an operator can safely compare it with the registered catalog value before changing source-controlled catalog configuration.

The browser will not modify published JSON, issue chain transactions, or imply that a logged-in override updates the public catalog. Implementation will correct the known registration value only after public address and selected-network evidence are verified; no recovery or signing material is needed.

Alternative considered: have Admin write catalog configuration directly at runtime. Rejected because this static Pages application has no authorized backend and a browser-side update would not be a trustworthy public deployment operation.

### 4. Extend the existing Admin Vite workspace into the one-origin development host

The root `npm run dev` command will continue to delegate to the integration-demo Vite workspace, but that Vite instance will serve explicit development HTML entries at `/admin/` and `/marketplace/`. Admin continues to use its current entry. The Marketplace development entry imports the Marketplace application and its styles into that same Vite module graph. The Vite configuration will mount Marketplace public catalog resources beneath `/marketplace/` during development and preserve direct refresh behavior for both paths.

This is a single Vite process and a single `http://host:port` origin; it does not copy IndexedDB, localStorage, or account state between origins. It merely lets the normal BIS persistence mechanism see the same browser origin from both routes. Separate package build configurations retain their respective GitHub Pages bases and production artifacts.

Alternative considered: launch two Vite servers behind a proxy. Rejected because it violates the requested one-Vite-server workflow and adds an unnecessary second process. Alternative considered: change persisted wallet storage keys to bridge ports. Rejected because browser same-origin boundaries are a security property, and it would make local behavior differ from deployment origins.

## Risks / Trade-offs

- [A public catalog address is stale or on the wrong network] → Surface address/network/source status in both Marketplace and safe Admin diagnostics; test successful empty separately from failed lookup; update the checked-in public anchor only through the normal reviewed deployment change.
- [A malformed trophy resembles a valid item by name] → Require the metadata discriminator and valid metadata fields; never fall back to display-name classification.
- [Shared Vite host changes standalone package behavior] → Keep the shared host development-only, retain existing standalone build bases, and add direct-route smoke coverage for all three modes.
- [One source lookup fails while the other succeeds] → Render source-scoped outcomes and prevent one source from filling the other owner's filter.
- [A trophy could reach an action handler despite hidden controls] → Preserve typed trade eligibility and reject trophy records at action entry as well as in the UI.

## Migration Plan

1. Add unit coverage around presentation classification and wallet-partitioned filtering before changing rendering.
2. Implement the new presentation adapter and source-state model, preserving the shared equipment/loadout API unchanged.
3. Add safe Admin source diagnostics and correct the verified public catalog address/network configuration through the reviewed static catalog workflow.
4. Add the shared development Vite entries and root command documentation, then run Admin-to-Marketplace browser persistence and refresh smoke tests.
5. Build the standalone Admin and Marketplace artifacts and verify their existing Pages routes remain independent.

Rollback is limited to restoring the previous application and development-host code in a subsequent additive commit; issued asset metadata and immutable artwork remain untouched. A stale registered address can be corrected in a follow-up static catalog deployment without wallet recovery or chain mutation.

## Open Questions

- None. The active Game Wallet public address is deliberately discovered through Admin's fresh public diagnostics during implementation and is not guessed from a player address.
