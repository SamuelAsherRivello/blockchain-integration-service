# Spec Delta

## MODIFIED Requirements

### Requirement: Use a wallet-scoped thirty-second cache

The Marketplace SHALL cache only JSON-safe public item results, wallet identity, active network, and a freshness timestamp in `localStorage`. Cache entries SHALL be scoped by wallet role, wallet profile identity, and network, and SHALL be considered fresh for 30 seconds. The cache SHALL contain no recovery phrase, signing material, raw SDK error, or private transaction payload. A cached empty Player Wallet result SHALL NOT remain authoritative after a newer successful BIS Account Assets read or an explicit Player Wallet inventory refresh for the same wallet and network.

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

#### Scenario: Fresh BIS Assets read supersedes empty cache

- **WHEN** BIS Account Assets completes with positive holdings for the active Player Wallet and network
- **THEN** a prior cached empty Player Wallet inventory is invalidated or bypassed
- **AND** the next Player Wallet tab read uses the fresh ownership evidence
- **AND** the Marketplace does not show an empty state solely because the earlier cache was empty
