> **TEACHING LESSON 2 · CONTRACT STATE MACHINES**

# Two Arkade contract demos

Read every transition as: caller + current state + next state + value effect.

[Home](Overview.md) · [GitHub repository](https://github.com/SamuelAsherRivello/blockchain-integration-service)

```mermaid
sequenceDiagram
    hide footbox
    participant C as Client (L3)
    participant W as Arkade Wallet (SDK L3)
    participant O as Arkade Operator (Off-Chain L2)
    participant B as Bitcoin (On-Chain L1)
    C->>W: create and fund 100 sats
    W->>O: submit escrow state
    C->>W: approve or claim
    O-->>W: release approved state
    O->>B: settle if required
    B-->>O: durable payout record
```


| State | Caller | Transition | Result |
| --- | --- | --- | --- |
| Created | Sender | Approve | Escrow becomes approved |
| Approved | Recipient | Claim | 100 sats pay recipient |
| Any | Sender | Refund after deadline | Optional safety path |

~~~text
createEscrow(sender, recipient, value):
  require(caller == sender)
  require(value == 100 sats)
  state = CREATED

claim():
  require(caller == recipient)
  require(state == APPROVED)
  state = CLAIMED
  pay(recipient, 100 sats)
~~~

Set state before paying so a successful claim cannot replay.

## Character draft

| Operation | Guard | State change |
| --- | --- | --- |
| Reroll | Owner; Draft | offense = random 0..10; defense = 10 - offense |
| Check | Owner | Returns state, level, attributes, points |
| Confirm | Owner; Draft | Becomes Confirmed |
| Level up | Owner; Confirmed; point available | Spend one point on offense or defense |

The invariant is offense + defense = 10 after each reroll. Confirmation permanently disables rerolling.

**Retrieval check:** Why does escrow need both a sender check and a recipient check?

Primary source: [Arkade smart contracts](https://docs.arkadeos.com/contracts/index.md).





