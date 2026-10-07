# Design

## Context

See [proposal.md](./proposal.md) for motivation. The manifest currently builds
routes as `base + slide`, while Slidev itself keeps the active slide in a hash
route. The shared launcher only needs the base path to choose a deck, so the
pathname slide suffix is redundant state.

## Goals / Non-Goals

**Goals:**

- Give every local deck view one authoritative, copyable slide position.
- Keep manifest-based deck ownership, proxy behavior, editor routing, and HMR
  isolation intact.
- Make canonical URL generation and rejection of duplicate slide state testable.

**Non-Goals:**

- Replace Slidev's hash router with a custom history router.
- Change published GitHub Pages URLs or authored slide content.
- Add redirects for legacy local URLs; local preview state is ephemeral.

## Decisions

### Treat the hash fragment as the active-slide authority

Canonical local links will be `<deck-base>#/N`; the pathname ends at the
manifest-declared trailing-slash base. Slidev already reads and updates this
fragment, so it prevents route drift without adapting the dependency's router.

Path-only URLs were considered because they are server-readable, but they
would require owning browser history fallback and replacing Slidev's router.
Synchronizing both formats was rejected because duplicated state can still
diverge.

### Separate deck-base ownership from browser navigation

Manifest helpers will expose a deck-base route for proxy, readiness, and editor
ownership, plus a canonical browser URL helper for a selected slide. Callers
that fetch documents will use the base pathname; callers that open a browser
slide will use the hash URL. Tests will make that distinction explicit.

### Keep public release links unchanged

Public Pages already use Slidev's hash format and retain their version query.
This change confines canonicalization to the local launcher and must not alter
the release contract.

## Risks / Trade-offs

- [Hash fragments are not sent to the server] → Server probes will validate the
  deck base, while browser probes verify the hash-selected active slide.
- [Old bookmarks can retain duplicate state] → The application will neither
  emit nor report them; new links are canonical and verification detects any
  reintroduction.
- [A call site uses a base URL where a selected-slide URL is needed] → Use
  separate helpers and focused unit/browser coverage.

## Migration Plan

1. Replace the overloaded manifest route helper with explicit base and
   canonical-browser URL helpers.
2. Update all launcher, supervisor, verifier, documentation, and theme call
   sites according to whether they need server routing or browser navigation.
3. Add unit and browser regression tests, then run the focused live-preview
   verification profile.

Rollback restores the former helper and call sites; it affects only local
preview URLs and does not modify deck source or release artifacts.
