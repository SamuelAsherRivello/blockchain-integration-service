# Proposal

## Why

Slidev preview URLs currently carry browser navigation in a hash fragment,
while older launcher routes can also include a pathname slide number. That
creates confusing, duplicate state rather than one clear presentation URL.

## What Changes

- Make the pathname the sole authority for the active slide: `/slidev/<deck>/<slide>`.
- **BREAKING** Replace hash-routed deck URLs with Slidev history routing.
- Generate canonical path-only local and public landing links and reject hash or
  duplicate-position routes in verification.
- Publish a static entry point for every public deck slide so direct GitHub Pages
  requests and refreshes retain the canonical path.

## Capabilities

### New Capabilities

- `slidev-canonical-navigation`: Provides unambiguous, shareable Slidev deck
  URLs with exactly one pathname slide position.

### Modified Capabilities

- `slidev-theme-layout-contract`: Existing documentation preview routes must
  remain usable under the canonical URL contract.

## Impact

- Slidev deck frontmatter, manifest, local launcher, supervisor, verification,
  landing generation, theme navigation, and preview documentation.
- The public Slidev build adds static deep-link entry points for GitHub Pages.
