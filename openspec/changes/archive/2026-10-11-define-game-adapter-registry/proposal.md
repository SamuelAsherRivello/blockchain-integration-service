# Proposal

## Why

The owned test-wallet runner has a persistent profile and exact-origin checks, but its application registry only knows BIS-owned routes. The larger acceptance change therefore cannot express the companion game as a registered, muted, provenance-verified application without either weakening the registry or inventing game-specific behavior in the runner.

## What Changes

- Add a BIS-owned game adapter definition with the evidence-backed `/blockchain-stealth-and-steel-game/` path and `muteMusic=true&muteSFX=true` launch query.
- Record the public `@bis/integration` 0.0.20 package provenance and the companion evidence document as a required, secret-free verification boundary.
- Register the game through the existing private vault application registry and make owned sessions accept only registered adapter definitions.
- Preserve exact origin, path, query, network, identity, recovery privacy, persistent-profile locking, and independent app storage checks.
- Add focused tests and a runbook note for the seam. This change does not modify the companion game repository, perform wallet operations, or claim live game restoration.

## Capabilities

### New Capabilities

- `game-adapter-registry`: BIS-owned registration and verification for the companion game adapter.

### Modified Capabilities

None. The parent acceptance change consumes this prerequisite.

## Impact

The runner's application registry and owned browser adapter are extended by one explicit application. Existing Admin, Marketplace, onboarding, and faucet registrations retain their current paths and behavior. The provenance record is public package metadata only; recovery phrases, browser databases, and journals remain private to each owned profile.
