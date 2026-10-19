# Proposal

## Why

The Prototype Sandbox currently demonstrates issuing, sending, receiving, and inspecting Arkade assets, but it does not show how a game item can move from one immutable asset definition to a newer one. A focused non-contract upgrade demo will teach the real production pattern without changing the existing atomic Mint Asset demo or implying that Arkade mutates asset metadata in place.

## What Changes

- Add one Prototype Sandbox `Upgrade Asset` page in the Assets navigation after the asset-history demos.
- Use the asset created by the existing Mint Asset demo as the upgrade source when its recorded asset ID is available.
- Keep Mint Asset atomic: it issues the selected asset to the mnemonic-backed demo wallet and does not send it.
- Make Upgrade Asset a real, network-backed sequence using the same mnemonic-backed wallet: verify the source holding, issue a replacement with level-two item metadata, verify the replacement, and burn the exact level-one holding.
- Persist a browser-local recovery record for the multi-step demo so interruption, retry, and already-completed phases do not submit duplicate work.
- Report the source asset, replacement asset, operation phases, transaction evidence, and final success truthfully; unresolved submission outcomes remain recoverable and are never presented as success.
- Add the route, navigation label, overview diagram, executable source display, automated coverage, and documentation needed to distinguish item migration from native asset reissuance.
- Keep smart contracts, control-asset reissuance, player-to-player delivery, and changes to the existing Mint Asset behavior out of scope.

## Capabilities

### New Capabilities

- `prototype-asset-upgrade`: Demonstrates a recoverable, non-contract migration from an existing Arkade asset holding to a replacement item asset.

### Modified Capabilities

- None.

## Impact

- Affected UI and demo code: `BIS/packages/prototype-sandbox/src/client/App.tsx`, navigation, and the sandbox overview/documentation surfaces.
- Affected tests: Prototype Sandbox route, coverage, source-format, browser-smoke, and operation-output tests.
- Runtime dependency: the existing `@arkade-os/sdk` asset issue and burn operations plus the selected Signet/Mutinynet operator; no new dependency or smart-contract artifact.
- Browser persistence: a namespaced IndexedDB or equivalent durable demo journal will be added for upgrade phases; it must contain only public identifiers, operation state, and transaction evidence, never recovery phrases.
