# X2 — Game wallet issues trophies

Status: deferred, proposal only; not ready for implementation.

## Why

Future trophies may be issued by the game wallet rather than self-minted by the player. This idea must remain separate from X1 wallet setup and Continue receipts so those features can ship independently.

## What Changes

- Reserve a separate future milestone for game-wallet trophy issuance and delivery.
- Preserve existing player self-minting until a later design is explicitly settled.
- Do not specify or implement the issuance mechanism in this change yet, as explicitly requested by the user.

## Capabilities

### New Capabilities
- `game-wallet-trophy-issuance`: prospective capability only; requirements are deliberately TBD.

### Modified Capabilities
TBD after discovery. No existing trophy requirement is changed by this placeholder.

## Impact

Potentially affects BIS asset operations, Admin and host trophy collection. Depends conceptually on X1's game wallet, but does not block X1. Signing location/availability, control assets, supply policy, authorization, issuance versus transfer, and repeat-award rules remain unresolved. No signing server, automatic issuer, control-asset design or limit of 999 has been approved as implementation scope. The employer's independently accessible demo remains a consideration for later design.

Specs, design and tasks are intentionally absent, not schema-skipped: this is a behavior change whose specification was explicitly deferred. Do not run apply or present this proposal as implementation-ready. The requested X2 label supersedes the intended milestone naming, but the current story document's Lightning X2 entry has not yet been renumbered.
