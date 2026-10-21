# Proposal

## Why

The sandbox demonstrates individual Arkade operations but has no visible, persistent observer that reacts while users try other demos. A separate Wallet 1 popup will demonstrate real public-address event subscriptions without requiring the recipient's mnemonic.

## What Changes

- Add an `Events` section after Assets and before Smart Contracts, containing one demo named `Events`.
- Execute opens a resizable 500 by 400 pixel React popup with a black background and a centered white card with 7px rounded corners. It displays `Wallet 1`, the captured network in parentheses, and connection/activity text.
- Observe the selected network's exact Wallet 1 address through SDK indexer script subscriptions, including received, spent, and swept VTXOs where supplied, asset-bearing outputs, and stream interruption/reconnection status.
- Keep the popup listening independently while users navigate the existing sandbox. Explain that Send Payment, Send Asset, and Send Payment from External Wallet can cause visible arrivals; Mint Asset alone affects Wallet 2.
- Replace the listening text with an evidence-based event description. Animate three 100% to 120% to 100% scale pulses with 0.5 seconds per half-cycle, then hold the newest message until five seconds after its display before returning to connection status. Newer events replace the message and restart timing.
- Cycle idle status dots once per second. Clicking the card, or using Enter/Space, flips it around the Y axis to a full-height scrollable connection/event log. History is chronological and lasts only for the popup session. Reduced motion removes spatial animation.
- Suppress historical startup/reconnection replay and duplicate notifications. Display connection failures truthfully using the same minimal card.
- Preserve the existing demo source convention with exactly Arrange, Act, and Assert sections.
- Keep the sidebar fixed-width while content flexes; show the selected network below larger demo-action labels. Read submitted Setup values for subsequent actions and isolate persistent SDK state by network and identity without deleting existing databases.
- Open readable local source windows during Vite development and GitHub source on Pages. Repair shared diagram loading and separate preview caches so all demo diagrams continue rendering.

## Capabilities

### New Capabilities

- `prototype-wallet-events`: Public-address event monitoring in an independent sandbox popup, including launch, observation, presentation, lifecycle, and verification.

### Modified Capabilities

None. The production player-wallet subscription and existing transaction demos keep their existing requirements.

## Impact

Changes cover the prototype-sandbox package, its tests and README, a public-evidence live runner, and scoped shared Vite diagram-cache configuration. Reuse SDK 0.4.79 and browser animation APIs; no new service or signing identity is needed by the monitor. Existing routes and wallet data remain intact. Signet and Mutinynet live delivery are verified separately from deterministic UI checks; public receipts are recorded in verification.md.

Accepted behavior includes one popup per opener, captured address/network, newest-event replacement, and monitoring after opener closure. The user approved these refinements and reconciliation of the planning artifacts before finalization on 2026-10-21.
