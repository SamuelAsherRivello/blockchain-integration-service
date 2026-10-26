> **TEACHING LESSON 3 · SHARED STATE**

# Anyone can increment

This toy contract has one shared integer and a one-minute cooldown. Permissionless access does not create independent per-player state.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: request increment
    W->>O: read current counter VTXO
    O-->>W: enforce 60-second cooldown
    W->>O: submit next counter state
    O-->>W: replace VTXO or report conflict
    O->>B: settle when required
    B-->>O: durable counter history
```


## The transition

1. Read the current state-bearing VTXO.
2. Require that no previous call exists or 60 seconds have elapsed.
3. Add one.
4. Replace the state with the new counter and timestamp.
5. Wait for the next allowed call.

~~~text
increment(now):
  current = readCurrentVtxo()
  require(current.lastCallAt is empty
          OR now >= current.lastCallAt + 60 seconds)
  replaceState(counter = current.counter + 1,
               lastCallAt = now)
~~~

The game should bootstrap and register the canonical instance. The first caller does not receive special ownership.

| Near-simultaneous calls | Outcome |
| --- | --- |
| Alice and Bob read the same state | They compete to spend one state |
| Alice wins | Bob becomes stale or conflicting |
| Bob refreshes | He retries against the new state |

A global cooldown serializes the world. Real games usually shard state per player, match, or room.

**Retrieval check:** Is this counter global or per-player, and why?

Primary source: [Arkade Functions](https://docs.arkadeos.com/experimental/arkade-functions).





