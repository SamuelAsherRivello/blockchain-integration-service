# Spec Delta

## Purpose

Provide a privacy-preserving, validated lifecycle signal so Marketplace can react when an owning business application changes either wallet session.

## ADDED Requirements

### Requirement: Public two-wallet lifecycle contract

The integration package SHALL expose a versioned browser lifecycle contract through which an owning application can report Player Wallet and Game Wallet activation and deactivation to a Marketplace instance in a configured trusted window relationship. Each notification SHALL identify exactly one role, active or inactive state, a monotonic session revision, and only the public identity/network/address evidence necessary for Marketplace display. It SHALL NOT carry recovery phrases, private keys, signing objects, balances, transaction payloads, or other secret wallet material. Marketplace SHALL reject malformed, stale, duplicate, untrusted-origin, or unexpected-source notifications without changing its wallet presentation.

#### Scenario: Trusted Player Wallet activation

- **WHEN** a configured business application reports a newer valid Player Wallet activation to Marketplace
- **THEN** Marketplace receives the public Player Wallet identity as an observed lifecycle state
- **AND** no recovery material or signing capability enters Marketplace through the notification

#### Scenario: Untrusted lifecycle message

- **WHEN** Marketplace receives a wallet lifecycle message from an unconfigured origin, an unexpected window, or with an invalid version or payload
- **THEN** Marketplace ignores the message
- **AND** its current wallet presentation, inventory, and action availability remain unchanged

#### Scenario: Older lifecycle revision

- **WHEN** Marketplace has already accepted a newer notification for a wallet role and later receives an older or duplicate revision for that role
- **THEN** Marketplace retains the newer observed state
- **AND** it does not revive a disconnected wallet or invalidate current work

### Requirement: Marketplace owns the response to observed lifecycle changes

Marketplace SHALL decide its own display and action policy after accepting a wallet lifecycle notification. An accepted activation SHALL refresh that role's Marketplace projection; it SHALL NOT itself create local signing authority or enable a payment, listing, or checkout that requires a locally verified wallet session. An accepted deactivation SHALL immediately remove that role's active wallet label and public identity from Marketplace presentation, invalidate role-scoped inventory and cached UI snapshots, and prevent obsolete asynchronous results from restoring them. If an active checkout depends on the deactivated role, Marketplace SHALL stop its remaining local progression and require a new checkout after eligible wallet sessions are re-established.

#### Scenario: Player Wallet logs out in the business application

- **WHEN** Marketplace accepts a Player Wallet deactivation while Player and Game Wallets are displayed
- **THEN** Marketplace removes the Player Wallet from its active presentation, clears Player Wallet inventory and wallet-dependent checkout state, and disables Player-required actions
- **AND** Marketplace applies its existing Game Wallet policy without displaying the removed Player Wallet as active

#### Scenario: Game Wallet logs out in the business application

- **WHEN** Marketplace accepts a Game Wallet deactivation while the Player Wallet remains active
- **THEN** Marketplace keeps the Player Wallet presentation available, removes the Game Wallet from active presentation, clears Game Wallet inventory and wallet-dependent checkout state, and disables Game Wallet-required actions
- **AND** it does not show the former Game Wallet address or items as current

#### Scenario: Wallet logs in without local signing authority

- **WHEN** Marketplace accepts an activation from the business application but has not independently restored the required local wallet session
- **THEN** Marketplace may display the observed public wallet state according to its policy
- **AND** it keeps signing, listing, and checkout actions disabled until their existing local eligibility checks pass
