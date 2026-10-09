# Spec Delta

## Purpose

Define one predictable loading policy for BIS views so automatic reads, modal coverage, loading placeholders, and short-lived reuse of recent successful data behave consistently across the embedded runtime.

## ADDED Requirements

### Requirement: Views expose explicit loading policy
Every data-backed BIS view SHALL have an explicit loading policy with `isLoadingAuto`, `isLoadingModal`, and `isLoadingCached` settings. Each setting SHALL default to true, false, and true respectively unless the view declares an intentional exception.

#### Scenario: Default view policy
- **WHEN** a data-backed view does not override its loading policy
- **THEN** entering the view starts its initial read, the view remains visible without a modal loading dialog, and a recent successful result may be reused

#### Scenario: Existing modal view
- **WHEN** a view declares `isLoadingModal=true`
- **THEN** its existing Pending Operation Dialog behavior remains active during its foreground read

### Requirement: Automatic and manual loading are distinct
Entering a view SHALL start a read only when `isLoadingAuto=true` and no valid cached result is available. An explicit Refresh SHALL always start a new read, bypassing the cache, regardless of `isLoadingAuto` or `isLoadingCached`.

#### Scenario: Automatic entry without cache
- **WHEN** the user enters a view with no valid cached result and its automatic loading is enabled
- **THEN** the view begins its read immediately and presents either its modal loading state or its non-modal loading state according to policy

#### Scenario: Explicit refresh
- **WHEN** the user activates Refresh on a view with a recent successful result
- **THEN** BIS bypasses that result and requests fresh data

### Requirement: Recent successful view data is cached in memory
When `isLoadingCached=true`, BIS SHALL retain a complete successful result in memory for 15 seconds by default. The cache SHALL be scoped by account identity, selected network, and data type, and SHALL NOT be persisted to browser storage.

#### Scenario: Return within freshness window
- **WHEN** the user leaves a view after a successful read and returns within 15 seconds for the same account, network, and data type
- **THEN** BIS reveals the cached result without starting another foreground read or loading dialog

#### Scenario: Expired result
- **WHEN** the user returns after the 15-second freshness window
- **THEN** BIS treats the result as unavailable for cache reuse and follows the view's automatic loading policy

### Requirement: Cache failures and invalidation are safe
Only complete successful reads SHALL enter the cache. Failed, partial, unavailable, account-changed, or network-changed results SHALL NOT be cached. Account changes, network changes, logout, reset, relevant wallet events, and explicit Refresh SHALL invalidate affected cached results.

#### Scenario: Failed read
- **WHEN** both attempts of a foreground read fail or a result is incomplete
- **THEN** no failed or partial data is cached and the next entry performs the normal read

#### Scenario: Account replacement
- **WHEN** the active account changes while cached data exists for the previous account
- **THEN** the previous account's data cannot populate the replacement account's view

### Requirement: Loading affordances identify active reads
While a view's foreground read is in progress, its refresh icon SHALL be disabled, visibly greyed out, and animated as a spinner. The animation SHALL stop when the read completes, fails, is cancelled, or the view is left. Reduced-motion preferences SHALL disable the animation while retaining the disabled styling.

#### Scenario: Automatic read indicator
- **WHEN** a view begins its automatic read on entry
- **THEN** its refresh icon, when present, is greyed out and spinning until the read reaches a terminal state

#### Scenario: Manual read indicator
- **WHEN** the user activates Refresh
- **THEN** the same greyed-out spinning indicator appears for the duration of that read
