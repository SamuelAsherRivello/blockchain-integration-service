# marketplace-inventory-cache Specification

## Purpose

Keep the Marketplace responsive while it obtains public item inventories from the Player Wallet and Game Wallet independently.

## Requirements

### Requirement: Maintain independent wallet inventories

The Marketplace SHALL maintain separate public inventory results for the Player Wallet and Game Wallet. A refresh SHALL begin eligible reads for both wallets asynchronously without requiring the result of one wallet before starting the other. Each result SHALL retain its own loading, success, empty, unavailable, and timestamp state.

#### Scenario: Both wallets are available

- **WHEN** the Marketplace refreshes with both wallet sessions available
- **THEN** it starts both reads independently
- **AND** a completed Player Wallet read does not wait for or replace the Game Wallet result
- **AND** a completed Game Wallet read does not wait for or replace the Player Wallet result

#### Scenario: One wallet is unavailable

- **WHEN** one wallet read fails while the other succeeds
- **THEN** the successful wallet retains its result
- **AND** the failed wallet retains an unavailable state
- **AND** the Marketplace does not represent the failed wallet as an empty inventory

### Requirement: Use a wallet-scoped thirty-second cache

The Marketplace SHALL cache only JSON-safe public item results, wallet identity, active network, and a freshness timestamp in `localStorage`. Cache entries SHALL be scoped by wallet role, wallet profile identity, and network, and SHALL be considered fresh for 30 seconds. The cache SHALL contain no recovery phrase, signing material, raw SDK error, or private transaction payload.

#### Scenario: Refresh within the freshness window

- **WHEN** a wallet has a successful cache entry less than 30 seconds old
- **THEN** the Marketplace immediately uses that cached inventory
- **AND** it does not show a loading prompt for that wallet
- **AND** it does not call the provider again for that wallet until the cache expires or the user explicitly retries it

#### Scenario: Page refresh and new tab

- **WHEN** the user reloads the Marketplace or opens it in a new tab within 30 seconds
- **THEN** the matching Player Wallet and Game Wallet cache entries are reused independently
- **AND** the Marketplace does not require a fresh provider read before showing those cached results

#### Scenario: Cache expires

- **WHEN** a cache entry is 30 seconds old or older
- **THEN** it is not treated as fresh
- **AND** the Marketplace starts a new read for that wallet
- **AND** a new successful result replaces the expired entry

### Requirement: Scope visible loading to the selected ownership tab

The Marketplace SHALL show its loading prompt only while the currently selected ownership tab lacks a usable fresh result and its corresponding wallet read is pending. A pending or unavailable read for the non-selected wallet SHALL NOT block the selected wallet's usable cached or fresh result.

#### Scenario: Player Wallet tab

- **WHEN** the Player Wallet tab is selected
- **THEN** the loading prompt waits only for the Player Wallet result
- **AND** a pending Game Wallet read does not keep the prompt visible after the Player Wallet result is ready

#### Scenario: Game Wallet tab

- **WHEN** the Game Wallet tab is selected
- **THEN** the loading prompt waits only for the Game Wallet result
- **AND** a pending Player Wallet read does not keep the prompt visible after the Game Wallet result is ready

#### Scenario: Rapid tab switching

- **WHEN** the user switches between Player Wallet and Game Wallet while both reads are pending or cached
- **THEN** each tab displays its own pending, cached, successful, or unavailable state
- **AND** switching tabs does not discard the other wallet's result or start a duplicate read within its fresh-cache window

### Requirement: Report selected-wallet failures explicitly

When the selected wallet cannot be read and has no usable fresh result, the Marketplace SHALL replace the loading prompt with an explicit error prompt. The error prompt SHALL identify that the selected wallet inventory is unavailable and SHALL offer a safe retry or refresh action. The Marketplace SHALL NOT silently show an empty state or claim that no items exist.

#### Scenario: Selected wallet read fails

- **WHEN** the selected wallet read returns unavailable or fails before producing a usable result
- **THEN** the loading prompt is removed
- **AND** an error prompt is shown for that wallet
- **AND** the other wallet's successful or pending state remains independent

#### Scenario: Retry after failure

- **WHEN** the user retries an unavailable selected-wallet read
- **THEN** only that wallet's expired or unavailable result is retried
- **AND** the other wallet's cached or active read is preserved
