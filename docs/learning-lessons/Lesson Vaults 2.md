> **VAULTS 2 · ARKADEOS**

# Shares, staging, and exit

Advanced vaults make ownership, withdrawal, and recovery explicit in the value flow.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: deposit value and receive share
    W->>O: request staged withdrawal
    O-->>W: stage rightful value
    C->>W: request exit
    W->>O: submit timeout or party evidence
    O->>B: settle withdrawal or exit
    B-->>O: durable recovery result
```


| Pattern | What it models | Why it matters |
| --- | --- | --- |
| Tokenized vault | Shares claim pooled value | Deposits and withdrawals are accountable |
| Fixed-party vault | Buyer, seller, or oracle committed | Address encodes participants |
| Exit path | Timeout or party set unlocks recovery | No happy-path operator dependency |

A tokenized vault may use one share per sat deposited. A deposit receives value, a pool holds it, and withdrawal stages value for the rightful owner.

**Design test:** Who can spend, under what evidence, and after which deadline?

**Game exercise:** List the winner payout, mutual refund, and timeout paths for a two-player escrow.

Primary sources: [Tokenized vaults](https://docs.arkadeos.com/v0.5/vaults/tokenized.md) and [Exit paths](https://docs.arkadeos.com/v0.5/vaults/exit.md).





