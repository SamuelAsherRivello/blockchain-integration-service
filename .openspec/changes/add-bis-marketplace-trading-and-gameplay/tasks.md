## 1. Trading feasibility and sessions

- [ ] 1.1 Verify the supported Arkade Signet sequence for a recoverable local asset-and-sats exchange between two browser-local accounts; document evidence and pause for a design update if it cannot meet the receipt requirements.
- [ ] 1.2 Add Marketplace Player Wallet Login and Game Wallet Login controls that open the existing BIS role-specific UI, with clear registered-address versus session-override display; verify protected actions cannot submit before both BIS sessions are active and the Marketplace contains no duplicate recovery or logout flow.
- [ ] 1.3 Implement truthful local buy and sell-back controls at approved listed prices with ownership/balance rechecks and reconciliation; verify uncertain outcomes are never retried as new trades.

## 2. BIS equipment loadout

- [ ] 2.1 Add catalog recognition and no-or-one active selection per Shoes, Dagger, and Shield family to BIS Account Assets; verify generic assets remain inspectable.
- [ ] 2.2 Persist and revalidate selections against fresh ownership and expose a minimal Arkade-free public loadout API; verify a lost item clears only its own selection.

## 3. Stealth & Steel integration

- [ ] 3.1 Agree and record numeric tier values for speed, player damage, and damage received before gameplay changes; verify focused game tests cover each family and baseline behavior.
- [ ] 3.2 Update the packaged Stealth & Steel consumer to use the public loadout API and apply only selected, still-owned effects; verify guest play remains account-free.

## 4. End-to-end verification

- [ ] 4.1 Test the same-browser two-wallet Signet proof of concept, Asset visibility, loadout selection, and truthful pending/unknown handling; verify no player-to-player control is exposed.
- [ ] 4.2 Build BIS packages and the packaged game consumer and perform browser smoke tests for guest and equipped-player flows; verify no private wallet material crosses either public boundary.
