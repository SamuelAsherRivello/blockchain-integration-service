## Why

Players can create and log out of a test account but cannot yet restore access using their saved recovery phrase. A3 completes that account lifecycle by restoring the same identity through the production UI and persistence used by both game hosts and the demo.

## What Changes

- Enable Restore Account from the logged-out Account dialogue, including after A6 logout.
- Provide a numbered recovery-word grid with manual entry, initially hidden words rendered as one `*` per character, and one Show checkbox for the whole grid.
- Add explicit Paste from Clipboard: hide the grid first, populate all fields from a correctly sized phrase, or retain existing fields and show an error for the wrong word count.
- Show green/red per-word BIP39 validity indicators and neutral empty fields. Require a valid complete phrase including checksum before enabling Restore; valid words remain green when a phrase-level checksum error is shown.
- Require real Signet connection before saving and activating. On success, immediately return to the Account dialogue showing "You are now logged in as Account ID: <first 4 characters>…<last 4 characters>." and emit the existing public accountConnected event for the same identity.
- On connection failure, retain the phrase only temporarily, hide it, and offer Retry/Back; Back clears the transient phrase.
- Add the A3 Admin demonstration and synchronize story documentation during implementation.
- Scope is account access only: no balances, achievements, full A4 menu, payment operations, arbitrary wallet imports, or gameplay recovery.

## Capabilities

### New Capabilities
- `account-restoration`: Private recovery entry, validation, Signet-gated restoration, safe persistence, failure handling, and identity continuity.

### Modified Capabilities
- `account-creation`: Align the shared logged-in Account ID presentation and current A3 copy compatibility.
- `account-entry`: Enable restoration and recognize its minimal active-account endpoint.
- `account-logout`: Offer enabled restoration after confirmed logout.
- `story-driven-demo`: Expose A3 through the production API and require accurate restoration evidence and diagrams.

## Impact

Implementation will affect integration UI, Core orchestration, the Arkade adapter, public non-secret lifecycle controls, Admin composition, tests, and account documentation. Reuse the installed Arkade SDK and BIP39 dependency and the existing encrypted account format; no new dependency or storage migration is proposed. Recovery material must remain outside public state, events, logs, and demo history.

Planning defaults to verify during implementation: the grid matches A2's current 12-word English phrase format; normalize case and whitespace without correcting or reordering words. Clipboard permission failures preserve entry and permit manual typing. No additional material scope decisions are unresolved; live Signet restoration remains an explicit verification gate, not an already demonstrated capability.
