## Purpose

Prove real partial Bitcoin-to-Arkade onboarding in an isolated Signet browser application with verifiable transaction evidence.

## ADDED Requirements

### Requirement: Persistent measured step durations
The spike SHALL record observed start and completion timestamps per step in browser local storage and show previous completed samples' average, sample count, total duration divided by count, and current elapsed duration. Timers SHALL survive reloads and averages SHALL persist across account recreation on the same origin. Incomplete, uncertain, failed, duplicate and unmeasured historical durations MUST NOT count as completed samples. Each step SHALL explain its measurement boundaries, including user/faucet delay and offline wall-clock time where applicable. An observed average SHALL replace the rough estimate when samples exist. Timing errors MUST NOT interrupt wallet processing.

#### Scenario: Two completed samples and one pending
- **WHEN** a step has completed durations of 10 and 30 seconds plus an unfinished run
- **THEN** its average is 20 seconds with two samples and a displayed calculation of 40 seconds divided by two; the unfinished duration appears separately

#### Scenario: Reload or repeated observation
- **WHEN** a completed step is observed again or the app reloads
- **THEN** its stored sample is not duplicated, and an active step retains its original start

### Requirement: Independent persistent account
The spike SHALL create a fresh Signet account only when Create is clicked, without BIS state or integration code, show a copyable public Bitcoin address in Step 2, and retain its account and operation across reopening. Recreate SHALL manually create another account while retaining the previous encrypted account data. Recreation MUST be blocked during unresolved transfers. Step 1 SHALL offer hidden-by-default recovery details with explicit Reveal/Hide and Copy controls. New accounts SHALL use seed phrases; existing random-private-key accounts SHALL retain their identity and be clearly labeled as having no seed phrase. Recovery details MUST NOT enter logs, files, timing storage or chat and SHALL be hidden after 60 seconds or leaving the tab.

#### Scenario: Existing funded private-key account
- **WHEN** the updated app restores an existing account
- **THEN** its identity remains unchanged and Step 1 offers its recovery private key without inventing a seed phrase

#### Scenario: New seed account
- **WHEN** the user creates a new account
- **THEN** its saved 12-word phrase restores the same Signet identity and remains hidden until explicitly revealed

#### Scenario: Reopen after funding
- **WHEN** the user reopens the same origin
- **THEN** the same address and pending operation are restored without creating another account

### Requirement: Explicit half-balance boarding
The user SHALL faucet the displayed address and authorize boarding with a button enabled only after incoming funds are confirmed and eligible. The spike SHALL snapshot and revalidate the funded input set on that click and deliver floor(funded sats / 2) to Arkade, with fees paid from the Bitcoin remainder. Automatic full boarding MUST be disabled. Legacy waiting-for-funding authorization SHALL require a new click under this revised flow.

#### Scenario: Unconfirmed faucet deposit
- **WHEN** an incoming deposit is unconfirmed
- **THEN** confirmation progress is shown and the onboarding button remains disabled without authorizing a future submission

### Requirement: Clearly owned sequential steps
The spike SHALL show six numbered steps with CPU or USER ownership and explicitly approximate duration estimates: CPU Create account, USER Open faucet and fund, CPU Wait for incoming Bitcoin, USER Onboard 50%, CPU Track Bitcoin to Arkade, and CPU Confirm usable Arkade funds are ready. Incoming Bitcoin evidence and onboarding transfer evidence SHALL appear in separate steps. Automatic status checks SHALL retain a five-second countdown on the refresh button.

#### Scenario: Pending deposit
- **WHEN** the faucet deposit has not confirmed
- **THEN** Step 3 displays incoming evidence, Step 4 is disabled, and Steps 5 and 6 do not claim a transfer or usable funds

#### Scenario: Invalid amount or unsupported fee
- **WHEN** exact half and valid Bitcoin change cannot be constructed
- **THEN** the spike explains the blocker without submitting or substituting another amount

### Requirement: Durable single submission
The spike SHALL preserve submission progress and automatically check uncertain outcomes without duplicate submission across clicks, tabs or reopening.

#### Scenario: Connection interrupted after submission
- **WHEN** a network response is missing or the browser reopens
- **THEN** the existing operation is checked, its last known status remains visible and no new intent is submitted

### Requirement: Evidence-based success
The spike SHALL show fresh Bitcoin and Arkade balances, fees and public transaction identifiers. It MUST report success only when the captured inputs are spent by the verified commitment, expected Bitcoin change is confirmed and the target amount exists as linked owned spendable Arkade outputs.

#### Scenario: Registration alone
- **WHEN** the operator returns an intent ID without verified settlement
- **THEN** the spike remains pending rather than showing success
