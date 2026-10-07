# Tasks

## 1. Path-only canonical navigation

- [ ] 1.1 Change declared Slidev decks to history routing and replace the manifest helper with explicit deck-base and pathname canonical-route helpers; verify focused manifest tests accept `baseN` and reject `#/N`.
- [ ] 1.2 Update launcher, supervisor, readiness/coherence verifier, Mondrian theme navigation, and documentation to use the correct base or pathname helper; verify no generated local route contains a hash or duplicate slide state.

## 2. Direct-link and release support

- [ ] 2.1 Update the public landing and release builder to emit path-only links and static per-slide entry points; verify the public build contains `<deck>/<slide>/index.html` for every declared slide.
- [ ] 2.2 Add browser coverage for opening `/slidev/<deck>/<slide>`, refreshing it, and advancing navigation while only the pathname changes; verify focused live-preview tests pass.
