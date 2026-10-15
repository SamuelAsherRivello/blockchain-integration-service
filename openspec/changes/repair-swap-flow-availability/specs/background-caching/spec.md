# Spec Delta

## ADDED Requirements

### Requirement: Complete balance cache coverage
The shared balance cache SHALL retain the complete validated balance projection, including per-side available amounts, under the active account, network, lifecycle, and evidence scope. A partial projection SHALL NOT satisfy Account Details' complete balance dependency.

#### Scenario: Details joins a warm balance
- **WHEN** Account Details opens after a compatible complete balance read has warmed the cache
- **THEN** it renders totals and per-side availability from that cached projection without another duplicate balance read

#### Scenario: Legacy or partial cache entry
- **WHEN** a cached entry lacks a required per-side availability field
- **THEN** the entry is not treated as complete and a current read prepares the missing complete projection
