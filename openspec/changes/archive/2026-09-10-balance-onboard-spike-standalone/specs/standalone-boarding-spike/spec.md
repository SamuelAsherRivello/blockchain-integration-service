## Purpose

Prove real partial Bitcoin-to-Arkade onboarding in an isolated Signet browser application with verifiable transaction evidence.

## ADDED Requirements

### Requirement: Persistent measured step durations
The spike SHALL record observed start and completion timestamps per step in browser local storage and show previous completed samples' average, sample count, total duration divided by count, and current elapsed duration. Timers SHALL survive reloads and averages SHALL persist across account recreation within the same window. Incomplete, uncertain, failed, duplicate and unmeasured historical durations MUST NOT count as completed samples. Each step SHALL explain its measurement boundaries, including user/faucet delay and offline wall-clock time where applicable. An observed average SHALL replace the rough estimate when samples exist. Timing errors MUST NOT interrupt wallet processing.

#### Scenario: Two completed samples and one pending
- **WHEN** a step has completed durations of 10 and 30 seconds plus an unfinished run
- **THEN** its average is 20 seconds with two samples and a displayed calculation of 40 seconds divided by two; the unfinished duration appears separately

#### Scenario: Reload or repeated observation
- **WHEN** a completed step is observed again or the app reloads
- **THEN** its stored sample is not duplicated, and an active step retains its original start

### Requirement: Independent persistent account
The spike SHALL create a fresh Signet account only after confirmed Restart, without BIS state or integration code, show a copyable public Bitcoin address in Step 2, and retain its account and operation across reload and reopening of its window URL. Restart SHALL remain enabled during unresolved transfers and require confirmation before archiving the previous encrypted account and operation. Archiving MUST NOT claim to cancel a submitted transfer or move existing funds. Step 1 SHALL offer one Restart button and a Seed Phrase Creation selector with Auto as default and Manual for a locally entered valid phrase. Step 1 SHALL offer hidden-by-default recovery details with explicit Reveal/Hide and Copy controls. New accounts SHALL use seed phrases; existing random-private-key accounts SHALL retain their identity and be clearly labeled as having no seed phrase. Recovery details MUST NOT enter logs, files, timing storage or chat and SHALL be hidden after 60 seconds or leaving the tab.

#### Scenario: Existing funded private-key account
- **WHEN** the updated app restores an existing account
- **THEN** its identity remains unchanged and Step 1 offers its recovery private key without inventing a seed phrase

#### Scenario: New seed account
- **WHEN** the user creates a new account
- **THEN** its saved 12-word phrase restores the same Signet identity and remains hidden until explicitly revealed

#### Scenario: Reopen after funding
- **WHEN** the user reopens the same window URL when it is not already active
- **THEN** the same address and pending operation are restored without creating another account

### Requirement: Automatic selected-percentage boarding
The user SHALL fund the displayed address using the faucet action opening https://signet.2nd.dev/. Step 4 SHALL automatically snapshot and revalidate confirmed eligible funding without an onboarding button, using the Step 1 selected percentage from 1 through 100, default 50. The net Arkade target SHALL be floor(funded sats multiplied by selected percentage / 100). Automatic SDK background settlement SHALL remain disabled; the spike owns the authorized flow. Unsupported fees or invalid amounts SHALL block submission without changing the selected target.

#### Scenario: Unconfirmed faucet deposit
- **WHEN** an incoming deposit is unconfirmed
- **THEN** confirmation progress is shown and automatic onboarding waits until funding becomes confirmed and eligible

### Requirement: Clearly owned sequential steps
The spike SHALL show six numbered steps with CPU or USER ownership and explicitly approximate duration estimates: CPU Create account, USER Fund the account, CPU Wait for incoming Bitcoin, CPU Onboard selected percentage, CPU Track Bitcoin to Arkade, and CPU Confirm usable Arkade funds are ready. Incoming Bitcoin evidence and onboarding transfer evidence SHALL appear in separate steps. Automatic status checks SHALL retain a five-second countdown on the refresh button.

#### Scenario: Pending deposit
- **WHEN** the faucet deposit has not confirmed
- **THEN** Step 3 displays incoming evidence, Step 4 waits automatically, and Steps 5 and 6 do not claim a transfer or usable funds

#### Scenario: Invalid amount or unsupported fee
- **WHEN** the exact selected target and valid Bitcoin change cannot be constructed
- **THEN** the spike explains the blocker without submitting or substituting another amount

### Requirement: Durable single submission
The spike SHALL preserve submission progress and automatically check uncertain outcomes without duplicate submission across clicks, tabs or reopening. Automatic runs SHALL persist recovery intent and capped backoff, reconcile the original inputs and exact receipts, and recover temporary signing/network failures through the SDK only after the previous signer cleans up. Validation failures SHALL stop automatic signing with a visible explanation.

#### Scenario: Connection interrupted after submission
- **WHEN** a network response is missing or the browser reopens
- **THEN** the existing operation is reconciled, its last known status remains visible, and only safe SDK recovery of the original transfer can register again after cleanup; a completed transfer is not duplicated

### Requirement: Evidence-based success
The spike SHALL show fresh Bitcoin and Arkade balances, fees and public transaction identifiers. It MUST report success only when the captured inputs are spent by the verified commitment, expected Bitcoin change is confirmed and the target amount exists as linked owned spendable Arkade outputs.

#### Scenario: Registration alone
- **WHEN** the operator returns an intent ID without verified settlement
- **THEN** the spike remains pending rather than showing success

### Requirement: Operator-compatible partial onboarding
The spike SHALL board the frozen input total without Bitcoin outputs, then return the non-target remainder to the original Bitcoin address in a second settlement. It SHALL show both phases and retain both public commitments. The intermediate whole-total Arkade balance MUST NOT satisfy success. Later deposits SHALL remain untouched.

#### Scenario: Bitcoin change is not accepted with boarding inputs
- **WHEN** onboarding the captured total
- **THEN** the first intent contains only an Arkade output; the second spends only the resulting Arkade receipts and outputs the exact Bitcoin remainder plus the exact Arkade target

#### Scenario: Second settlement awaits confirmation
- **WHEN** the final Arkade target is spendable but either Bitcoin commitment remains unconfirmed
- **THEN** the spike continues verification and does not claim full completion

### Requirement: Window-isolated state and address URL
The spike SHALL keep independently opened windows in separate local account, operation, preference and timing scopes. Reload SHALL retain the current scope; opening an already-active window URL in another tab SHALL create an independent scope. The URL SHALL contain the current window identifier and actual public btcAddress once the saved account connects. URL address metadata MUST NOT determine signing identity. The first scoped window SHALL retain the legacy account and history without erasing other data.

#### Scenario: Independent duplicate window
- **WHEN** the user opens the active spike URL in another tab
- **THEN** the second tab gets independent state and changing its preferences does not change the first tab

### Requirement: Readable timing and transaction layout
The spike SHALL show estimated total duration and the last observed completed six-step duration above Step 1. Step headers SHALL vertically center title, owner and status with timing at the right on desktop. Pending titles SHALL be yellow and interrupted settlement titles red. Incoming and settlement transaction scroll areas SHALL reserve 1.5 item heights even when empty.

#### Scenario: Empty history
- **WHEN** the account has no transactions or completed runs
- **THEN** both transaction viewports retain their reserved height and total timing distinguishes an estimate from absent observed history

#### Scenario: Full boarding selected
- **WHEN** the selected percentage is 100
- **THEN** the spike performs only the full boarding leg and verifies the exact target with zero Bitcoin change before success