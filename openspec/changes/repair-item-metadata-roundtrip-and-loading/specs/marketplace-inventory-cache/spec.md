## ADDED Requirements

### Requirement: One bounded inventory attempt with explicit recovery
Marketplace inventory preparation SHALL perform one bounded read per wallet, sharing overlapping work without extending its deadline. Failure SHALL settle as unavailable and remain actionable until explicit Retry or a relevant ownership/session change. Retry SHALL start fresh work. Cancel SHALL dismiss the error without starting loading or clearing wallet data. Other errors SHALL retain allowCancel=false by default.

#### Scenario: Provider never settles
- **WHEN** a wallet inventory provider remains pending past the deadline
- **THEN** loading ends and a readable enabled Retry action and Cancel action appear
- **AND** the abandoned request cannot publish a late result

#### Scenario: Explicit retry succeeds
- **WHEN** Retry is clicked after failure and the next provider read succeeds
- **THEN** one fresh loading attempt replaces the error and reveals the returned items
- **AND** no other wallet read is restarted

#### Scenario: Cancel leaves browsing available
- **WHEN** Cancel is clicked on an inventory error
- **THEN** the modal closes and the Marketplace remains navigable without a new read
