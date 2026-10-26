> **INTENTS 2 · ARKADEOS**

# Routes, solvers, and recovery

An intent is safe only when the player understands the route, limits, and failure path.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: submit intent with limits
    W->>O: request solver route
    O-->>W: quote with expiry and recovery terms
    O-->>W: deliver fill or failure result
    O->>B: follow settlement or timeout rule
    B-->>O: confirm recovery boundary
```


A route may involve Arkade, Lightning, on-chain Bitcoin, or an asset corridor. A solver finds liquidity and submits fulfillment.

| Question | Why it matters |
| --- | --- |
| What result is guaranteed? | Defines success |
| When does the quote expire? | Limits stale terms |
| What if the solver disappears? | Defines failure handling |
| Who can recover, and when? | Prevents trapped value |

An intent is the request and quote layer. A smart contract may enforce settlement, but the intent itself is not automatically a contract.

**Game exercise:** Name one responsibility of the intent layer and one responsibility that belongs in a contract.

Primary sources: [Markets and quotes](https://docs.arkadeos.com/intents/markets-and-quotes.md) and [Trust and limitations](https://docs.arkadeos.com/intents/trust-and-limitations.md).





