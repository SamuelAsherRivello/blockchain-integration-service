[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: choose lesson concept
    W->>O: model wallet action
    O->>B: explain settlement boundary
    B-->>O: durable Bitcoin result
    O-->>W: updated VTXO state
    W-->>C: lesson output
```


> **BLOCKCHAIN TEACHING LESSONS**

# Learn Arkade by building the mental model

A practical set of short lessons for understanding ArkadeOS wallets, assets, intents, oracles, vaults, and smart contracts through game-oriented examples.

> **How to use this map.** Choose a concept, read its two short lessons, and then ask a question or explain the idea back in your own words. The sections are alphabetized so the map stays easy to scan.

## Assets

Bitcoin-native value that can represent game items, currencies, or other owned objects.

- [Assets 1](Lesson%20Assets%201.md): Asset IDs, control assets, and metadata.
- [Assets 2](Lesson%20Assets%202.md): Issuing, reissuing, burning, and verifying assets.

## Intents

Requests for payments or swaps that solvers can quote and fulfill.

- [Intents 1](Lesson%20Intents%201.md): Intent, quote, fund, and fill.
- [Intents 2](Lesson%20Intents%202.md): Routes, solvers, and game-safe recovery.

## Oracles

Signed outside data that a contract can use when deciding whether a spend is valid.

- [Oracles 1](Lesson%20Oracles%201.md): Attestations and signed data.
- [Oracles 2](Lesson%20Oracles%202.md): Coupling, identity, open coins, and aggregation.

## Smart Contracts

Bitcoin-verifiable spending rules for escrow, state transitions, and shared game logic.

- [Teaching Lesson 1](Lesson%201.md): Blockchain and ArkadeOS smart-contract foundations.
- [Teaching Lesson 2](Lesson%202.md): Escrow and character-contract state machines.
- [Teaching Lesson 3](Lesson%203.md): Permissionless counters, cooldowns, and shared state.
- [Teaching Lesson 4](Lesson%204.md): Pay-to-witness, signatures, hashes, timelocks, and Taproot.

## Vaults

Contracts that hold BTC or assets and release them under explicit rules.

- [Vaults 1](Lesson%20Vaults%201.md): Vaults as programmable value containers.
- [Vaults 2](Lesson%20Vaults%202.md): Shares, staging, fixed parties, and exit paths.

## Wallets

The application-facing layer for addresses, balances, payments, and VTXO lifecycle.

- [Wallets 1](Lesson%20Wallets%201.md): Identity, addresses, balances, and payments.
- [Wallets 2](Lesson%20Wallets%202.md): Boarding, settlement, renewal, and recovery.

---

Each lesson includes a retrieval exercise and links to its primary ArkadeOS documentation. Ask follow-up questions as you work through them.






