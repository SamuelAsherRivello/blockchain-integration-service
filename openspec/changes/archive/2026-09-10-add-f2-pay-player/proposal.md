**F3. Send 1000 Sats (Game->Player): Complete ✓**, confirmed by the user on 2026-09-09. The historical change name uses F2. Remaining acceptance is closed on user confirmation; no new live payment was performed in this update.

## Why

The demo can inspect an independent F1 game wallet but cannot pay the Runtime Preview player from it. F2 provides a fixed-value payment demonstration with truthful receipt feedback inside the preview.

## What Changes

- Add F2 `Pay 1000 Sats To Player` under F. Game Wallet, sending exactly 1000 Signet sats from the selected F1 wallet to the active Runtime Preview player's Arkade address.
- Grey out and disable F2 without an active player account; also prevent unavailable-sender, self-payment, insufficient-funds, and duplicate pending submissions.
- Add shared session-wide incoming Bitcoin/Arkade and own-transfer notifications, with pending/final states and no historical replay.
- After verified F2 receipt, enqueue `User <short sender ID> Sent You 1000 Sats` in the receiving preview's shared toast UI.
- Keep payment recovery bound to the original sender and recipient; report failures or uncertain outcomes truthfully without a success toast.

## Capabilities

### New Capabilities
- `game-wallet-player-payment`: fixed-value game-wallet-to-player sending, receipt verification, and session-safe notification.

### Modified Capabilities
- `story-driven-demo`: F2 action, availability, and documentation/evidence.

## Impact

Extends the existing F1 controller in `BIS/packages/integration/src/core/game-wallet.ts`, shared Arkade sending/recovery integration and public exports; updates demo `GameWalletPanel.tsx` and `App.tsx`. Reuses shared toast presentation and wallet safeguards. No custom server, new dependency, mainnet route, or changes to the separate game repository.

Confirmed interview: immediate F2 sending, all incoming payments, Unknown User fallback, pending then final toasts, own transfers included, and silent loaded history. Display defaults: F1 is the sender; “player” means the active logged-in preview account, not a rendered game character. `ASDF....ASDFA` is illustrative: display the sender public profile ID's first four and last five characters separated by four periods (short IDs remain whole). These are recorded interpretations, not separate user-confirmed decisions. F1 is concurrently implemented under `add-admin-game-wallet-and-continue-payments`; coordinate against its current controller and preserve its storage contract. Live F2 feasibility and receipt correlation remain to be verified during implementation; existing sending code is not evidence of a completed F2 payment.

Latest UI decisions: append the actual F2 blocking reason, show payment-usable balance in F1, and replace all Admin console contents on every new output. F1/F3 Details report fresh wallet/boarding status respectively.
