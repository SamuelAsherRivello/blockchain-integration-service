## Context

See proposal.md for motivation and the delta specs for behavior. The completed implementation covers Marketplace wallet-session UI, an atomic-exchange capability gate, public chain metadata and catalog assets, H1/H2 Game Wallet tooling, encrypted player profiles, and BIS loadout management. The installed Arkade SDK remains Signet-only and no custom service or wallet secret crosses package boundaries.

## Goals / Non-Goals

**Goals:**

- Make the nine catalog assets self-describing on-chain and render their chain-provided URLs in BIS and Marketplace.
- Retain multiple encrypted player profiles and isolate loadout selections by public profile ID.
- Provide a small Arkade-free equipment API and package it for the approved game consumer.
- Keep trade actions available only when one recoverable atomic Arkade asset-for-sats operation is proven.

**Non-Goals:**

- Hosted coordination, custody, player-to-player listings, compensation-based settlement, fees, or a buy/sell spread.
- A game Settings/HUD integration or gameplay effects; those remain in `complete-stealth-game-equipment-and-verification`.
- Treating an item name, ticker, static catalog record, or bundled artwork key as proof of classification or ownership.

## Decisions

### Prove the atomic boundary before enabling trade

The installed SDK must expose one recoverable operation that prevents one-sided asset or sats settlement. If it does not, Marketplace reports a stable unavailable reason and exposes no separate transfer fallback. The recorded SDK 0.4.71 assessment rejected the required primitive, so the completed implementation preserves disabled Buy and Sell controls while independent Marketplace and equipment flows remain usable.

### Use one versioned chain metadata envelope

Generic asset APIs round-trip JSON-safe metadata while retaining generic behavior. The shared Arkade-free catalog validates the Stealth & Steel item envelope, approved price, family, tier, and HTTPS `iconUrl`; H1 uses new v2 operation identities and H2 only handles freshly classified items owned by the active Game Wallet.

### Store profiles and loadouts independently

IndexedDB retains an encrypted profile collection with an optional active pointer. Equipment selections use a versioned record scoped to the profile's public ID, and a fresh ownership read removes unavailable selections without affecting other families or profiles.

### Keep the game boundary public and Arkade-free

The packaged `@bis/integration` artifact exports only JSON-safe equipment state and selection behavior. The consumer workflow has no source alias, Arkade dependency, recovery material, or Marketplace implementation detail.

## Risks / Trade-offs

- **SDK atomic exchange remains unsupported** → retain a truthful disabled gate and no submission path.
- **Older catalog holdings lack required metadata** → classify them as generic rather than fabricating item meaning.
- **Profile migration or ownership refresh fails** → preserve saved state safely, expose no unverified effective loadout, and keep unrelated interaction available.
- **Icon URL fails** → show an honest unavailable image state without a bundled substitute.

## Migration Plan

1. Ship backward-compatible metadata, profile, and loadout storage.
2. Apply H1/H2 and Marketplace session behavior with the atomic capability gate.
3. Build and pack the public package boundary for the authorized consumer.
4. Roll back deployment without deleting chain assets or saved profile data; a separate follow-on change owns game behavior and live acceptance.
