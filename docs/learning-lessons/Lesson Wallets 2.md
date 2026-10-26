> **WALLETS 2 · ARKADEOS**

# Boarding, settlement, and renewal

Arkade wallet value has a lifecycle: enter the system, move off-chain, renew before expiry, and retain an exit path.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: board on-chain value
    W->>O: make off-chain payment
    O-->>W: return VTXO state
    W->>O: renew before expiry
    W->>O: request settlement
    O->>B: settle value
    B-->>O: confirm base-chain result
```


| Stage | Purpose | Player-facing state |
| --- | --- | --- |
| Boarding | Bring value into Arkade | Funding |
| Payment | Exchange VTXO-backed value | Pre-confirmed or complete |
| Settlement | Move to base chain | Settling |
| Renewal | Refresh expiring VTXOs | Healthy or needs attention |

Storage and service-worker choices also matter in a browser game because the wallet needs durable access to local state and recovery material.

Show pending, confirmed, expiring, and settled states distinctly. “The UI says paid” is not automatically the same as a durable, recoverable claim.

**Retrieval check:** What should the game show when a pre-confirmed payment’s VTXO is approaching expiry?

Primary sources: [Boarding](https://docs.arkadeos.com/wallets/advanced/boarding.md) and [Renewal](https://docs.arkadeos.com/wallets/advanced/renewal.md).





