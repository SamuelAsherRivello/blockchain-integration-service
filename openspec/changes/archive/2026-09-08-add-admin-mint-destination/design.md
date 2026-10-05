## Context

See proposal.md for motivation. Admin already selects a wallet and calls its mintAsset method, but prepareMintDestination first requires getMintAvailability to succeed and report sufficient funds. That captured availability is not refreshed while the same destination remains open. Production createBisAssetCollection calls the player's context.mintAsset after ownership and pending-operation checks, without that separate availability veto. Player context and game wallet controller both delegate issuance to mintWalletAsset. The game repository references a packaged integration version, so matching version labels do not establish identical code. These are verified differences; the precise live cause of the user's Awaiting Balance result has not been proven.

## Goals / Non-Goals

**Goals:** Extend demo composition while preserving wallet-bound operation identity, accessibility, and retry safety.

**Non-Goals:** Arbitrary addresses, game-funded issuance delivered directly to a player, mint-then-send, new control assets, trophy issuance changes, wallet import changes, or changes to the separate game repository.

## Decisions

1. Keep a demo-owned destination type (`player` / `game`) outside BisMintAssetRequest. Resolve it to the existing context/controller in App. Extending the public request with host-specific wallet roles would unnecessarily couple generic minting to demo composition.
2. Default a new window to Game wallet. Reuse context.mintAsset as the player issuance entry point for both production collection and Admin, and retain the game controller's delegation to the same underlying mintWalletAsset implementation. Do not add a parallel Admin issuance implementation or change the production mint method merely to make Admin pass. Remove getMintAvailability as an Admin submission gate and remove any balance-only gate on C1 entry. Wallet presence/activity, valid form input, pending-read success, immutable recovery and duplicate-submission guards remain. Insufficient funds is reported from the production mint result at the explicit Mint action, not from a cached Admin decision. Production collection keeps its existing ownership policy, metadata, explicit collection action and toast behavior.
3. Resolve pending state on opening and idle destination changes. Disable submission during lookup; treat failures as failures rather than an empty pending list. Preserve draft metadata for fresh requests but generate a new operation ID when switching wallets. Recover pending metadata and ID from the chosen wallet. Lock destination after submission until a definitive outcome permits editing; closing retains existing durable recovery records. When reopening with pending work, allow destination selection before entering the locked recovery form so a game-wallet pending request cannot trap access to player-wallet work (or vice versa).
4. Capture controller/context, public profile ID, and a form generation before asynchronous work. Check all three before updating UI or submitting. Invalidate when the selected wallet changes, without presenting a late result as a replacement wallet's operation. Log the selected destination and originating public identity, never recovery material.
5. Reuse the existing field layout and native labeled select with matching dark-theme CSS. Keep presets, focus handling, responsive scrolling, validation and runtime-preview isolation.

## Risks / Trade-offs

- Stale pending lookup after destination change → generation checks and blocked submission during lookup. Stale Admin balance cannot veto submission because production alone validates funds.
- Wrong-wallet reconciliation → bind destination, profile and operation ID as one immutable operation session.
- Pending mint hidden by insufficient balance → entry/recovery eligibility is distinct from new-mint funding eligibility.
- Existing uncommitted wallet and C1 work → implement against the current checkout and reconcile overlapping planning changes without overwriting unrelated edits.
- Confusing Destination with a transfer recipient → helper text explicitly states that the selected wallet funds and receives the mint.

## Migration Plan

No storage migration or new dependency. Add the demo selector and routing, verify existing recovery records in both destinations, and update C1 documentation. If rollback is needed, use an additive corrective edit restoring the previous demo routing while preserving all wallet journals.

## Latest confirmed scope

Preserve player-funded player issuance, including the game's existing level-completion flow, and game-funded game issuance. The intervening idea of always funding from the game wallet is superseded by the user's later request to match existing production behavior without changing it. Cross-wallet delivery remains outside this change. Existing completed checks describe earlier implementation; the new parity work is pending in task group 5.

## Follow-up instruction: payment labels and F3 amount

The user requested `(Player->Game)` at the end of B1 and `F3. Send 100 Sats (Game->Player)` during implementation. B1 retains its existing price. F3 changes its new-payment quote, saved metadata and minimum balance guard to 100 sats. Pending-payment detection reads the amount from each existing journal so historical 1000-sat operations remain protected. The overlapping reorganize-game-wallet-actions delta uses the same current F3 wording.
