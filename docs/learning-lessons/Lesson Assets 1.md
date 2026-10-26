> **ASSETS 1 · ARKADEOS**

# Assets: identity plus quantity

An Arkade asset gives value an identity in addition to its quantity.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: request asset balance
    W->>O: read asset ID and quantity
    O-->>W: return typed VTXO value
    W-->>C: show item or currency balance
    O->>B: settle asset transfer
    B-->>O: durable asset record
```


> **Mental model:** typed value = quantity plus asset ID.

| Field | Meaning | Game example |
| --- | --- | --- |
| Quantity | Units present | 100 gold or 1 sword |
| Asset ID | Kind of value | Gold or Sword-847 |
| Metadata commitment | Committed description | Name, image, item details |
| Control asset | Issuance authority | Studio minting key |

## Asset versus contract

An asset describes **what is owned**. A contract describes **which spending evidence is accepted**.

A sword can therefore be an asset while an escrow contract controls when it moves from seller to buyer.

**Retrieval check:** Why can one sword and 100 gold use the same asset model?

Primary source: [ArkadeOS Assets overview](https://docs.arkadeos.com/assets/index.md).





