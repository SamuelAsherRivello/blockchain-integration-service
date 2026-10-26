> **TEACHING LESSON 1 · BLOCKCHAIN FOUNDATIONS**

# Smart contracts on Bitcoin, then Arkade

A smart contract is a rule controlling how value may move. Arkade adds fast off-chain VTXO transitions while preserving Bitcoin-oriented spending rules and exit paths.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: request value transition
    W->>O: provide caller and contract state
    O-->>W: authorize next VTXO
    O->>B: settle when required
    B-->>O: durable result
    O-->>W: updated wallet state
    W-->>C: transaction status
```


> **Mental model:** an Arkade contract is a programmable envelope around value, not automatically a global program with a shared database.

| Model | Persists | Valid transition |
| --- | --- | --- |
| Ethereum-style contract | Program storage | Code executes and changes storage |
| Bitcoin output | UTXO and locking rule | Spending evidence satisfies the rule |
| Arkade VTXO | Virtual output plus state | A valid next-state spend, off-chain or settled |

## Where cost appears

There is usually no separate deployment-gas moment for constructing a script. Costs appear when funding value, paying operator or route fees, paying Bitcoin miner fees, and renewing or settling VTXOs.

**Design prompt:** Does the rule need to travel with the value? If yes, escrow, payout, refund, or spending-limit logic may belong in a contract.

**Retrieval check:** What is the difference between creating a contract rule and funding a value-bearing instance?

Primary sources: [ArkadeOS](https://arkadeos.com/), [VTXO lifecycle](https://docs.arkadeos.com/learn/pillars/batch-expiry), and [TypeScript SDK](https://arkade-os.github.io/ts-sdk/).





