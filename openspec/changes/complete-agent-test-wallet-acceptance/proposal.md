# Proposal

## Why

The committed agent-test-wallet foundation removes repeated manual login for supported owned workflows, but does not yet prove the complete autonomous ecosystem workflow. Finish the remaining adapters and live acceptance without conflating this follow-up with the completed foundation milestone.

## What Changes

- Reuse the completed vault, Shared configuration, inventory, authorization, accounting and initial browser runners; do not rebuild or reimport identities unnecessarily.
- Complete game/application adapters, independent owned UI interaction beyond the fixed catalog, conservative preparation and rotation, and asset/contract recovery scenarios.
- Complete the public 50% onboarding scenario and reconcile both settlement legs on Signet and Mutinynet. Keep funding separate from onboarding.
- Investigate the live Swap Review-control failure despite the isolated availability-race regression passing; verify actual settlement before using conversion as a funding prerequisite.
- Run the supplied-account lifecycle and agent-created create → fund → onboard → use matrix across registered applications and the game, with exact public package provenance.
- Verify real user-selected joined-session navigation/detach and subsequent owned work without authority leakage.
- Close full-suite/build/release-exclusion gates and report unperformed or unavailable cases honestly.

## Capabilities

### New Capabilities

- `agent-wallet-scenarios`: Autonomous test scenario readiness, preparation, conversion, rotation and ecosystem acceptance built on agent-test-wallets.

### Modified Capabilities

None. Existing product account, transfer, asset and contract requirements remain authoritative; this adds developer orchestration and acceptance, not production bypasses.

## Impact

Depends on the [archived foundation](../archive/2026-10-11-add-agent-test-wallet-workflow/milestone.md) and the separately owned onboarding network work. Existing test identities, encrypted generations, browser profiles and unresolved operation IDs must survive continuation. No renewed test-spending approval, mandatory budget/expiry, mainnet use, secret export or human-profile takeover is introduced.

The inherited-scope.md file preserves the original unsplit plan for traceability; this proposal, design, scenario spec and tasks are authoritative for the remainder. Completed inherited checkboxes identify reused baseline only, not new end-to-end acceptance. Implementation stops at the user's checkpoint until explicitly resumed.
