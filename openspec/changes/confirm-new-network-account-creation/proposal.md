# Proposal

## Why

Restoring a valid recovery phrase currently saves and activates its account immediately. For test users who deliberately reuse one phrase on separate supported networks, the first local setup on a network should be explicit, so they can distinguish restoring a saved profile from creating a fresh, network-scoped profile without implying that balances or history transfer.

## What Changes

- After validating a recovery phrase and the currently selected network operator, detect whether the derived identity is already saved locally for that network.
- When no such local profile exists, show a confirmation headed **Create New Account?** before saving or activating it. The prompt explains that the phrase has no account on the selected network yet and asks whether to create one now.
- Make **Cancel** leave no new profile or activation, and make **Create Account** save and activate the network-scoped profile.
- Preserve automatic restoration for an identity already saved locally on the selected network.
- Keep recovery material private; do not infer network membership from an address or claim that the application can determine whether an account exists elsewhere.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-restoration`: Require explicit confirmation before first local persistence of a verified recovery phrase on the current network.

## Impact

- Affects the integration account restoration state machine, account storage lookup, production recovery UI, and restoration tests.
- Reuses existing configured-network and operator-mismatch validation; no new service, dependency, wallet protocol, or cross-network migration is introduced.
