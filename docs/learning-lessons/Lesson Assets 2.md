> **ASSETS 2 · ARKADEOS**

# The asset lifecycle

Issuance defines what can enter, leave, and be trusted in the game economy.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: issue, reissue, or burn asset
    W->>O: submit asset operation
    O-->>W: apply control and metadata rules
    W->>O: verify incoming asset
    O->>B: settle operation
    B-->>O: durable asset history
```


1. **Issue** — create an identity and initial quantity.
2. **Reissue** — create more units when control rules permit.
3. **Burn** — destroy units so they cannot circulate.
4. **Verify** — check asset ID and metadata before trusting a display name.

| Object | Fungibility | Reissuable? | Possible burn |
| --- | --- | --- | --- |
| Gold | High | Usually yes | Fees or crafting |
| Trophy | None | Usually no | Never or migration |
| Crafting material | Often high | Maybe | Recipe consumption |

**Design prompt:** Choose one item. Decide whether it is fungible, reissuable, and burnable.

Primary sources: [Issue assets](https://docs.arkadeos.com/assets/issue-assets.md) and [Reissue and burn](https://docs.arkadeos.com/assets/reissue-and-burn.md).





