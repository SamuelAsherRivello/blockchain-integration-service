> **ORACLES 1 · ARKADEOS**

# Signed outside data

An oracle bridges an outside fact and a contract. It signs a statement; the spending rule verifies the signature.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>O: provide outside fact
    O-->>W: attach signed oracle message
    W->>O: submit contract spend
    O->>B: settle oracle-dependent spend
    B-->>O: verify key, bytes, and script
    O-->>W: accepted or rejected result
    W-->>C: show payout status
```


~~~text
outside fact
    ↓
oracle signs message
    ↓
contract checks key + message + signature
    ↓
spend becomes valid or invalid
~~~

| Contract can verify | Contract cannot prove alone |
| --- | --- |
| Expected key signed the bytes | Signer measured reality honestly |
| Message has expected shape | Match result was not manipulated |
| Attestation can enter the spend | Signer will always be available |

For a tournament, an oracle might sign “match 42 winner = player A.” The escrow contract verifies it before releasing the prize.

**Retrieval check:** What trust question remains after signature verification?

Primary source: [ArkadeOS Oracles overview](https://docs.arkadeos.com/v0.5/oracles/overview.md).





