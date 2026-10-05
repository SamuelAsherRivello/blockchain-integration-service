## Purpose

Coordinate a real, recoverable local Signet checkout between two wallets held by one Marketplace browser, without granting any remote seller authority.

## ADDED Requirements

### Requirement: Local dual-wallet checkout activation
The Marketplace SHALL retain public item browsing without a wallet. Its left sidebar SHALL show the current Player Wallet and Game Wallet statuses without duplicate Player Wallet Login or Game Wallet Login controls. It SHALL show an instruction area in which `Enable Item Listing` is enabled by default and does not require a wallet. `Enable Item Sales` SHALL reveal the existing Account route required for the POC: use the upper-right Account button to create or restore the Player Wallet, then use Account → Developer → Game Wallet Login to create or restore a distinct Game Wallet. The Marketplace SHALL enable Buy and Sell only when both distinct local sessions are active and their fresh state is eligible; it SHALL not expose wallet recovery or signing material in the sidebar.

#### Scenario: Operator enables item sales without both wallets
- **WHEN** the operator selects Enable Item Sales while either required wallet is absent
- **THEN** the Marketplace keeps sales unavailable and gives the upper-right Account instructions for the missing role
- **AND** it does not render a second sign-up, restore, or recovery control in the sidebar

#### Scenario: Item detail is not yet eligible for sales
- **WHEN** an item detail is open before local sales prerequisites are met
- **THEN** it displays `Buying and selling are not enabled. Follow the instructions in the left sidebar.` instead of an atomic-SDK capability explanation
- **AND** neither Buy nor Sell submits a transaction

#### Scenario: Both local wallet sessions are ready
- **WHEN** distinct eligible Player Wallet and Game Wallet sessions are active in the same Marketplace browser
- **THEN** the Marketplace identifies both roles in the sidebar and enables the applicable Buy or Sell action for a freshly verified item
- **AND** the public listing remains available independently of those sessions

### Requirement: Recoverable local purchase and sell-back
The Marketplace SHALL treat every local purchase and sell-back as a durable, exact-item POC operation. A purchase SHALL first transfer the exact verified price from Player Wallet to Game Wallet, then deliver the exact verified quantity of that Game Wallet item to the Player Wallet. A sell-back SHALL first deliver the exact verified Player Wallet item to the Game Wallet, then transfer its exact verified price to the Player Wallet. Before either first leg is submitted, the operation SHALL bind the two distinct profiles, exact asset ID and quantity, price, direction, and intended recipient. It SHALL verify each confirmed leg from fresh wallet evidence and SHALL not call a trade complete until both legs are confirmed.

#### Scenario: Purchase completes in the local POC
- **WHEN** a Player Wallet buys a freshly available Shoes I item from the active Game Wallet
- **THEN** the Player Wallet pays exactly 1,000 sats and receives that exact item quantity
- **AND** the Game Wallet receives the price and no longer has that item available for another purchase

#### Scenario: Payment completes but delivery is interrupted
- **WHEN** the purchase payment is confirmed but item delivery is interrupted or acknowledgement is unavailable
- **THEN** the operation remains visibly pending with recovery or reconciliation available
- **AND** the Marketplace never represents the item as purchased until fresh Player Wallet ownership confirms the exact item

### Requirement: Item-scoped pending behavior
An unresolved local checkout SHALL reserve only its conflicting exact item and wallet inputs. The Marketplace SHALL keep catalog browsing, wallet status, loadout inspection, and disjoint safe actions available while it presents the pending operation and its next recovery step. It SHALL prevent duplicate purchase, sell-back, payment, delivery, or burn of the reserved exact item until reconciliation reaches a terminal result.

#### Scenario: One item is pending
- **WHEN** a Dagger II delivery is pending after its local payment
- **THEN** Dagger II cannot be bought, sold, delivered, or burned again
- **AND** the operator can continue viewing other items and using unrelated safe Marketplace controls
