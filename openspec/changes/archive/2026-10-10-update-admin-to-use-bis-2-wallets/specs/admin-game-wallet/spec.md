# Spec Delta

## ADDED Requirements

### Requirement: Admin and Runtime share one two-wallet session
The same-origin Admin and Runtime Preview SHALL observe and mutate one active Player Wallet context and one independently selected Game Wallet controller for the lifetime of the demo session. A wallet selected or changed through either surface SHALL become the current wallet for the other surface without duplicating identities or silently creating a second wallet session.

#### Scenario: Runtime-selected wallets appear in Admin
- **WHEN** the operator logs in a distinct Player Wallet and Game Wallet through Runtime Preview on the shared demo origin
- **THEN** Admin A.G.1 and A.G.3 identify and operate on those same public wallet identities
- **AND** Admin SHALL NOT report an empty or unrelated Game Wallet solely because the login occurred through Runtime Preview

#### Scenario: Admin-selected Game Wallet appears in Runtime
- **WHEN** the operator imports or selects a distinct Game Wallet through Admin A.G.1
- **THEN** Runtime Preview A.G.2 and game-facing operations observe the same selected public Game Wallet
- **AND** the Player Wallet remains unchanged

#### Scenario: Wallet or network changes during an operation
- **WHEN** the Player Wallet, Game Wallet, or active network changes while an Admin operation is preparing or reading
- **THEN** the operation is cancelled or rejected before signing or submission if its captured wallet scope is no longer current
- **AND** already-submitted work remains bound to its original public identities and network

### Requirement: A.G.3 reports actionable availability diagnostics
A.G.3 SHALL distinguish a ready wallet, known zero, loading state, insufficient eligible funds, unresolved operation, role or network mismatch, wallet-read failure, provider or live-evidence failure, pending boarding, and confirmed boarding. It SHALL not use a generic unavailable label when a safe specific category is available, and it SHALL not present stale or unavailable data as current spendable balance.

#### Scenario: Live boarding evidence is unavailable
- **WHEN** the selected Game Wallet is ready but the provider cannot supply the fresh transaction evidence needed for the boarding probe
- **THEN** A.G.3 reports live-evidence or provider-read unavailability with a retry-oriented explanation
- **AND** it does not label the wallet boarded, awaiting confirmation, or available for a submission that the failed read cannot justify

#### Scenario: Wallet public read is unavailable
- **WHEN** fresh address or balance reads fail after the bounded retry policy
- **THEN** A.G.3 reports wallet-read unavailability and retains the selected identity without showing the failed balance as zero
- **AND** a later explicit Details action re-evaluates current state

#### Scenario: Ready distinct wallets with eligible funds
- **WHEN** the Player Wallet and distinct Game Wallet are ready on the active network, fresh evidence is available, and no durable operation blocks the requested action
- **THEN** the relevant A.G.3 action is enabled and its Details output identifies the current public wallet scope and payment-usable balance
