# Proposal

## Why

The standalone Onboarding and Faucet tools expose useful Signet evidence, but their current presentation makes a developer scan a long, equal-weight stack before finding the next action. Admin and Marketplace establish a stronger local pattern: compact operational chrome, explicit status, and details that stay available without competing with the primary workflow.

## What Changes

- Reframe both routes as developer runbooks with a short environment header, a single current state, and chronological content from setup through verification.
- Make the next safe action visually primary while keeping the existing Arkade/Signet behavior, evidence, recovery, timing, and error semantics unchanged.
- Use native disclosure/foldout sections for diagnostics, public identifiers, transaction evidence, timing calculations, and implementation notes.
- Give Onboarding a compact progress rail and six ordered stages; keep completed/pending/error state visible in each stage header.
- Give Faucet a chronological request flow: configure network, inspect faucet health, submit a destination/amount, then inspect delivery and transaction evidence.
- Keep both routes aligned to the Admin developer-facing visual language and reuse the pattern as a candidate for later Admin backporting; do not modify Admin in this change.
- Add a minimal top bar to both prototype routes: the route title plus a `Network` dropdown for Signet and Mutinynet. Changing networks asks for confirmation with `This will reset all data on the page` and resets the current page state before loading the selected network.

## Capabilities

### New Capabilities

- `developer-runbook-surfaces`: Chronological, disclosure-based presentation rules for the standalone developer tools.

### Modified Capabilities

- `standalone-boarding-spike`: The six-step onboarding experience gains the new chronological runbook information architecture without changing wallet behavior.
- `standalone-spike-resilience`: Recovery, diagnostics, and public evidence remain available through explicit foldouts and status regions.

## Impact

- UI markup and CSS in `BIS/packages/prototype-onboarding` and `BIS/packages/prototype-faucet`.
- Existing client state, API calls, local storage, transaction evidence, and test contracts remain intact.
- New UI-focused smoke assertions may be added for stage order, disclosure state, and primary-action labeling.
