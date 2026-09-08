# F1 — Admin game wallet and Pay to Continue

## Why

Admin currently operates on the Runtime Preview player's wallet, and Continue payments go to a generated sink recipient. The demo needs an independently retained game wallet that receives those payments and lets the operator verify the balance increase.

## What Changes

- Milestone 1: import an existing game wallet directly in Admin and retain it separately in encrypted browser storage; provide payment-usable balance (including 0) and fresh public status through Details under F. Game Wallet. Use one recovery-phrase field to import or select retained wallets, restore the last selection on reload, and provide F3 Board Game Wallet with status-only Details, quote/confirmation, and live-evidence waiting disablement.
- Milestone 2: route new Continue payments to a public game-wallet address supplied through host build configuration, including the separately deployed Stealth game. Receipt requires no Admin browser or signing server.
- Preserve player login, pending-payment recovery, asset-preserving sends and session-bound continuation effects.
- **BREAKING**: new Continue submissions require a configured recipient and no longer generate sink wallets. Previously submitted sink payments remain recoverable.
- Keep minting controls and player self-minted trophies unchanged. X2 is the separate deferred `add-game-wallet-trophy-issuance` change.

## Capabilities

### New Capabilities
- `admin-game-wallet`: independent imported game-wallet storage, public receiving-address controls and fresh balance inspection.

### Modified Capabilities
- `pay-to-continue`: replace generated recipients for new payments with a configured game recipient and bind the recipient to operation identity.
- `game-pay-to-continue`: pass public recipient configuration through the shared controller and disable payment when configuration is unavailable.

## Impact

BIS account storage/lifecycle, public context and continuation interfaces, demo Admin composition, and the Stealth host integration/build configuration are affected. Planning is centralized here; the named `babylon-lite-stealth-grid` repository is the downstream consumer. No custom server, GitHub signing secret, new dependency or minting change is included. Credentials are entered in the target browser, never chat, build environment or repository. Public addresses may be committed. F1 replaces the former X1 milestone label and belongs under F. Game Wallet. Preserve historical change paths; X2 remains the separate deferred trophy proposal, with its existing appendix naming collision explicitly deferred.

Design defaults: existing mnemonic restoration format, event-driven balance refresh and status-only Details, and retention of all imported game wallets with phrase-based selection and no dropdown. Live two-wallet verification remains implementation work, not an established capability.
