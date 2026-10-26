> **ORACLES 2 · ARKADEOS**

# Coupling, identity, and aggregation

Oracle designs vary in signer coupling, identity stability, and number of signers.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: choose signer or quorum policy
    W->>O: request oracle-backed transition
    O-->>W: provide signed or aggregated attestation
    W->>O: submit spend evidence
    O->>B: settle policy-valid spend
    B-->>O: verify committed rule
    O-->>W: return result
```


| Design | Strength | Trade-off |
| --- | --- | --- |
| Coupled signer | Simple verification | Signer change may require a new address |
| Stable identity | Survives script changes | More system design |
| Open coin | Another contract can read the value | More complex recursive flow |
| Aggregation | Quorum or median | More coordination and failure cases |

One tournament operator is simple but creates one authority. Three-of-five referees reduce dependence on one signer but require coordination.

**Decision prompt:** Which model would you choose for a prize payout, and which failure are you avoiding?

Primary sources: [Signed messages](https://docs.arkadeos.com/v0.5/oracles/signed-messages.md) and [Aggregation](https://docs.arkadeos.com/v0.5/oracles/aggregation.md).





