**F2. Board Wallet: Complete ✓**, confirmed by the user on 2026-09-09. Historical verification evidence is retained; this update records user acceptance without claiming new automated or live checks.

## Why

The Game Wallet section should follow the operator's sequence: log in, board, then pay the player. Its current numbering and mixed identity/balance controls obscure that sequence.

## What Changes

- F1. Game Wallet contains login/logout only, retaining the existing encrypted import and selection behavior.
- Move boarding to F2. Board Wallet. Once live evidence establishes boarding completion, replace the submission action with Boarded; retain status inspection and pending recovery without a local boarded flag.
- Move payment to F3. Pay 1000 Sats To Player. Show (Awaiting Balance) when payment funds are insufficient, and enable payment when eligible.
- Proposed presentation default: move usable balance and wallet Details to F3; retain boarding Details in F2. Preserve console replacement and receipt toasts.
- Preserve non-balance safety guards. Missing player, same identity, provider failure and unresolved submission cannot truthfully be described as insufficient balance.
- Apply baseline: do not re-offer boarding after live-confirmed completion, including later deposits. The recommended exception was not accepted.
- Non-balance blockers retain disabled safeguards with an accessible explanation outside the button suffix.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-game-wallet`: separate identity controls from inspection, renumber boarding and retain a live-confirmed Boarded state.
- `story-driven-demo`: renumber payment to F3, simplify its balance-wait label and synchronize documentation.

## Impact

GameWalletPanel.tsx, game-wallet.ts and the live boarding evidence adapter/helper; focused wallet tests and browser fixtures; User Story Diagrams.md and package documentation. No new dependencies, secret storage, financial protocol changes, or edits to the separate game. Existing F proposals remain historical implementation records; this change supersedes their affected presentation requirements. The apply request proceeds with the stated no-repeat baseline.
