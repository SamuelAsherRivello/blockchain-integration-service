> **INTENTS 1 · ARKADEOS**

# Intent, quote, fund, fill

An intent states the result a player wants. A solver proposes the route and terms.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: create payment or swap intent
    W->>O: request route and quote
    O-->>W: return amount, fee, expiry, and route
    W->>O: fund quoted value
    O-->>W: fill requested result
    O->>B: settle if required
    B-->>O: durable settlement
```


| Step | Meaning | Game example |
| --- | --- | --- |
| Intent | Desired result | Swap a sword for sats |
| Quote | Amount, fee, expiry, route | 10,000 sats for 30 seconds |
| Fund | Supply required value | Player commits sword |
| Fill | Complete the result | Solver delivers sats |

The quote turns a vague request into concrete terms and may name the contract or route that settles the trade.

## Why games care

A game can request a payment, swap, or Lightning settlement without embedding every liquidity source in its client. It still must show the player the terms before commitment.

**Retrieval check:** What must a quote make explicit for a sword-for-sats trade?

Primary source: [ArkadeOS Intents overview](https://docs.arkadeos.com/intents/index.md).





