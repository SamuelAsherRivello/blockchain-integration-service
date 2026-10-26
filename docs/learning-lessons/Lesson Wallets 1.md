> **WALLETS 1 · ARKADEOS**

# Identity, addresses, and payments

The wallet is the application-facing owner of keys, addresses, balances, and payment actions.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: request payment or contract action
    W->>W: authorize and sign
    W->>O: send signed operation
    O-->>W: return VTXO result
    O->>B: settle when needed
    B-->>O: durable result
    W-->>C: update balance and status
```


| Layer | Responsibility | Example |
| --- | --- | --- |
| Account | Application identity | Player profile |
| Wallet | Keys and signing | Approves payment |
| Currency or asset | What is owned | 25 units or one sword |
| Contract | Conditions on movement | Winner-only payout |

An Arkade address is more than a username: it commits to a script describing spending conditions. The game requests an action; the wallet authorizes it.

**Retrieval check:** Which layer chooses the item, which authorizes payment, and which proves ownership?

Primary source: [ArkadeOS Wallets overview](https://docs.arkadeos.com/wallets/index.md).





