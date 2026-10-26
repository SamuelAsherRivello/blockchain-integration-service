> **TEACHING LESSON 4 · BITCOIN CONTRACT FOUNDATIONS**

# Pay-to-witness: evidence unlocks value

The output commits to a lock. The spending input supplies evidence. The verifier decides whether the evidence satisfies the lock.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: provide witness evidence
    W->>O: submit spend attempt
    O->>O: check locking rule and witness
    O->>B: settle valid spend
    B-->>O: verify Bitcoin script
    O-->>W: valid or rejected result
```


| Part | Question |
| --- | --- |
| Locking rule | What conditions must a spend satisfy? |
| Witness | What signature, script, secret, or proof is supplied? |
| Verifier | Does the evidence satisfy the commitment? |

| Shape | Mental model | Evidence |
| --- | --- | --- |
| P2WPKH | One key | Signature and public key |
| P2WSH | Hashed script rule | Script plus witness |
| P2TR | Key path or script leaf | Key or script-path witness |

This is a validity test, not a normal function call returning a value.

~~~text
prize output:
  claim path: winner signature
  refund path: sender signature after a delay
~~~

Hashes commit to secrets, timelocks delay paths, and output checks preserve value or encode the next state.

**Retrieval check:** What is the difference between a locking script and a witness?

Primary source: [Arkade Functions](https://docs.arkadeos.com/experimental/arkade-functions).





