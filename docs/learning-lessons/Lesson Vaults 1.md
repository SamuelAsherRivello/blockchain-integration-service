> **VAULTS 1 · ARKADEOS**

# Programmable value containers

A vault is a contract-controlled container for BTC or assets. Value enters, and approved spending paths release it.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: deposit BTC or asset
    W->>O: fund vault state
    C->>W: request normal spend or exit
    W->>O: provide evidence and deadline
    O-->>W: release next VTXO state
    O->>B: settle spend or exit
    B-->>O: durable vault result
```


| Phase | Question | Example |
| --- | --- | --- |
| Deposit | What value entered? | Two players fund escrow |
| Normal spend | Who may release it? | Winner claims the pot |
| Exit | What if normal path fails? | Timeout refund |

For every vault leaf, ask:

1. Who can spend?
2. What evidence do they provide?
3. What deadline or state must be true?
4. What value or next state is created?

**Game exercise:** Describe one normal spend and one emergency exit for a prize vault.

Primary source: [ArkadeOS Vaults overview](https://docs.arkadeos.com/v0.5/vaults/overview.md).





