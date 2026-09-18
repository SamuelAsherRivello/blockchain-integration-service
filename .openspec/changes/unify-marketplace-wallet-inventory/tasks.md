## 1. Marketplace asset presentation contract

- [ ] 1.1 Add failing Marketplace tests for verified equipment, verified player trophies, malformed metadata, and source attribution; verify the new tests fail before the presentation adapter exists.
- [ ] 1.2 Implement a Marketplace-specific discriminated asset presentation adapter that reuses equipment classification and separately validates trophy metadata; verify type checking and the presentation tests pass without changing `createBisEquipment` or equipment-loadout behavior.
- [ ] 1.3 Update Marketplace ownership reads to retain independent fresh game and player source states (`ready`, `empty`, `unavailable`, `unreadable`); verify a failed source cannot render as an empty or other-owner inventory.

## 2. Wallet-partitioned Marketplace rendering

- [ ] 2.1 Render Game Wallet equipment and Player Wallet equipment plus trophies from the presentation records, including source-aware empty/error text; verify owner filters show only their respective source and All retains owner identity.
- [ ] 2.2 Update game/type filtering and item detail rendering so all-types includes valid trophies while Speed/Offense/Defense include only their matching equipment families; verify a trophy card has no price, Buy, Sell, or loadout control.
- [ ] 2.3 Guard checkout/action entry against non-equipment presentation records even if invoked outside the visible UI; verify a trophy cannot start a local checkout.
- [ ] 2.4 Preserve runtime chain-icon behavior for both equipment and trophies with safe fallback rendering; verify rendered image URLs come from validated chain metadata rather than a name/ticker lookup.

## 3. Public game-inventory source and Admin evidence

- [ ] 3.1 Add tests for registered-address lookup, same-session Game Wallet override, selected-network labels, and empty-versus-unreadable outcomes; verify the Marketplace never claims an override updated public catalog configuration.
- [ ] 3.2 Implement source/status labelling and per-network registered catalog-address handling in Marketplace; verify the active game source is the logged-in role when present and otherwise the published network anchor.
- [ ] 3.3 Extend Admin H Marketplace output with fresh recognized-item evidence, selected network, and the active Game Wallet public address only; verify it contains no recovery, signer, or private transaction material.
- [ ] 3.4 Use the Admin evidence to verify and, if needed, correct the reviewed public catalog address for the supported network; verify the resulting anonymous Marketplace inventory read returns the expected live game equipment without relying on a player address.

## 4. One-origin local preview

- [ ] 4.1 Add a shared-development Vite host in the integration-demo workspace that directly serves `/admin/` and `/marketplace/` from one process, including Marketplace public catalog resources; verify both routes load and refresh on the same host and port.
- [ ] 4.2 Preserve the current standalone Admin and Marketplace build bases and Pages staging behavior; verify independent production builds and route verification still pass.
- [ ] 4.3 Document the single root run command and one local server URL/subroutes; verify it does not instruct developers to start separate Admin and Marketplace Vite processes.
- [ ] 4.4 Add automated browser coverage that selects a network and Game Wallet in `/admin/`, opens `/marketplace/` on the same origin, and verifies shared persisted role/network behavior without exposing wallet secrets.

## 5. End-to-end verification

- [ ] 5.1 Run focused Marketplace, integration, and integration-demo tests; verify player trophy presentation, game inventory display, non-trading guards, and Admin diagnostics pass.
- [ ] 5.2 Run the workspace type check and production build; verify no standalone Pages route regression.
- [ ] 5.3 Start the documented one-server local preview and perform a real-browser smoke test of `/admin/` then `/marketplace/`; verify game items render for the active game wallet, player equipment/trophies render for the active player wallet, and source/empty/error states are truthful.
