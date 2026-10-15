# Proposal

## Why

The current Player Wallet Log Out flow removes the selected encrypted local profile. A user who creates a network-scoped profile, logs out, and later restores the same recovery phrase on that network is therefore treated as a first-time local setup again. Log Out should end access to the active session without silently discarding the local profile it just created.

## What Changes

- Change Player Wallet Log Out from destructive profile removal to a local session disconnect: it clears the active selection and in-memory access, while retaining encrypted profiles and their profile-scoped recovery state in the selected network store.
- Keep the post-logout UI logged out and prevent reload from automatically reopening a retained profile.
- Allow restoration of a retained, inactive profile on the same network to activate that saved profile without another first-local-profile creation prompt or duplicate profile.
- Preserve the existing network boundary: Signet and Mutinynet profiles remain isolated, and logging out on one network cannot reveal, activate, or modify profiles on the other.
- Retain explicit destructive reset/removal behavior only behind its existing separate administrative/developer path; this change does not add a new profile-management UI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-logout`: Redefine confirmed Player Wallet Log Out as non-destructive session disconnection that retains the selected network's saved encrypted profile.
- `account-restoration`: Require a retained inactive same-network profile to be reactivated as an existing local profile rather than prompted as a first-time creation.

## Impact

- Affects integration account storage, logout coordination and cleanup, Player Wallet context lifecycle, and account-restoration handling.
- Updates logout, storage, restoration, and browser/UI regression coverage.
- Does not add an Arkade transaction, a remote account registry, a service, a dependency, or a cross-network profile migration.
