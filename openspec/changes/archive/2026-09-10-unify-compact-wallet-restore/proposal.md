## Why

The user-facing Game Wallet restore screen currently accepts a phrase through a single textarea, while Player Wallet restoration uses a safer, more legible numbered twelve-word grid. The two flows should present the same private-entry interaction and stay synchronized as the shared wallet UI evolves.

## What Changes

- Replace the Game Wallet restore textarea with the same numbered, masked, validated twelve-word recovery entry used by Player Wallet restoration.
- Extract that recovery entry into a reusable UI component used by both restoration flows, while allowing each flow to retain its own submit, error, and navigation behavior.
- Compact the two-column entry grid by reducing each input row's vertical space without changing its font, introducing an internal scrollbar, or reducing accessibility controls.

## Capabilities

### New Capabilities

- `game-wallet-restoration`: Restore a separately retained game wallet through the shared private twelve-word recovery entry experience.

### Modified Capabilities

None.

## Impact

- Affected code: `BIS/packages/integration/src/ui/RestoreAccount.tsx`, `GameWalletLogin.tsx`, shared recovery UI, and overlay styling.
- Affected verification: browser-facing restoration checks for the Player and Game Wallet flows.
- No core wallet API, persistence format, dependency, or network behavior changes.
