# Proposal

## Why

The local Slidev launcher currently puts a slide number in both its pathname
and Slidev's browser hash. Those independent values can diverge, making a
copied presentation link ambiguous and misleading.

## What Changes

- Make the Slidev hash fragment the sole canonical authority for the active
  slide in local preview URLs.
- Remove slide numbers from launcher-generated proxy paths; deck identity ends
  at its declared base path.
- Update landing links, runtime probes, verification, documentation, and theme
  navigation links to produce and validate one canonical URL form.
- Add regression coverage that rejects pathname slide suffixes and conflicting
  pathname/hash slide positions.

## Capabilities

### New Capabilities

- `slidev-canonical-navigation`: Provides unambiguous, shareable local Slidev
  deck URLs with exactly one authoritative active-slide position.

### Modified Capabilities

- `slidev-theme-layout-contract`: Existing documentation preview routes must
  remain usable under the canonical URL contract.

## Impact

- `BIS/documentation/slidev/scripts/live-preview-manifest.mjs` and its tests
- Local launcher links, readiness/coherence verification, and preview
  documentation
- Mondrian theme links that navigate among local deck and template routes
