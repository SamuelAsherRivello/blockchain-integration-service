# Design

## Context

See proposal.md for the motivation. The Marketplace currently derives `inventoryAddress` from the selected Game Wallet state and then falls back to the published catalog address. The integration Game Wallet controller already treats an absent Player Wallet as an empty game-wallet session, but the Marketplace fallback bypasses that boundary. Existing Admin behavior intentionally retains Game Wallet identities independently of Player logout.

## Goals / Non-Goals

**Goals:**

- Make active Player Wallet presence the prerequisite for all game-facing Game Wallet presentation and inventory reads.
- Remove stale or cached Game Wallet presentation after Player logout.
- Preserve public catalog browsing and Player Wallet inventory behavior.
- Preserve Admin Game Wallet retention and encrypted identity storage.

**Non-Goals:**

- Changing the published catalog schema or removing its registered public address.
- Deleting retained Game Wallet identities during Player logout.
- Changing Admin wallet controls, Game Wallet import, or server-side wallet policy.

## Decisions

1. **Gate the session override and catalog fallback on the active Player Wallet.** The Marketplace will derive a Game Wallet inventory source only when `playerState.profileId` is present. This prevents the public catalog address from becoming an active session wallet. An alternative would be to keep anonymous lookup and only hide the address, but that would still violate the requested no-wallet session boundary and continue exposing inventory.

2. **Invalidate the game result when the player identity disappears.** Player logout will cause the Marketplace source key to become empty for the Game Wallet role and will discard or bypass the prior result before rendering. The inventory coordinator remains role-scoped; no recovery material or private wallet data is added to its cache.

3. **Keep Admin retention separate from game-session visibility.** The integration Game Wallet storage and Admin controller remain unchanged. The Marketplace consumes only the active session state, so a retained Admin identity cannot leak into a logged-out game-facing page.

4. **Use browser-level regression coverage.** Unit/source tests will cover source construction and state transitions; Playwright will verify the visible logged-out Marketplace state and confirm that no Game Wallet address or stale inventory is presented.

## Risks / Trade-offs

- [Risk] Existing anonymous Game Wallet inventory behavior is intentionally removed. -> [Mitigation] Public catalog cards remain available, and the UI gives a truthful Player Wallet requirement for wallet-owned views.
- [Risk] A late Game Wallet read could publish after logout. -> [Mitigation] Scope the source to the active player identity, invalidate the source key on logout, and ensure stale results are not rendered for the logged-out state.
- [Risk] Existing retained Game Wallet data may be mistaken for deletion. -> [Mitigation] Keep Admin storage untouched and test that only the game-facing presentation is cleared.
