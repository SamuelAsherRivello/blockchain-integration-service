# Design

## Context

See [proposal.md](./proposal.md) for motivation. Slidev supports both hash and
history routers. The launcher owns deck selection by manifest base path, while
the browser router owns active-slide navigation.

## Goals / Non-Goals

**Goals:**

- Use one stable, copyable URL form: `<deck-base><slide>`.
- Preserve manifest-backed ownership, editor routing, HMR isolation, and direct
  deep links in both local preview and GitHub Pages builds.

**Non-Goals:**

- Include a build/version segment in canonical presentation URLs.
- Preserve hash URL compatibility or add redirects for old ephemeral local links.

## Decisions

### Use Slidev history routing and pathname slide numbers

Each deck will set `routerMode: history`. Canonical helpers produce a normalized
deck base for server operations and `base + N` for browser navigation. The
alternative hash mode was rejected because it hides the one meaningful route
component and made duplicate slide state easy to create.

### Route local deep paths through the owning deck

The Vite proxy already matches each manifest deck prefix. It will pass a
pathname such as `/slidev/deck/29` through to that deck's history-enabled
Slidev server; probes that only need a document continue to request its base.

### Materialize public deep-link pages at build time

GitHub Pages has no configurable history fallback. After each public Slidev
build, the release builder will copy its generated `index.html` to a numbered
`<slide>/index.html` directory for every rendered slide. This retains the
browser URL on first request and lets Slidev continue normal history navigation.

## Risks / Trade-offs

- [Published output contains one small HTML entry per slide] → Reuse the same
  built shell and generate only declared slide positions.
- [A route helper is used for a server fetch rather than browser navigation] →
  Keep base and canonical helpers separate and cover both in focused tests.
- [Old hash bookmarks stop being canonical] → Landing pages and runtime never
  emit them; they are intentionally outside this local-preview migration.

## Migration Plan

1. Change all declared decks to history routing and replace manifest URL helpers.
2. Update launcher, supervisor, verification, theme links, documentation, and
   public landing to use pathname slide routes.
3. Generate public static deep-link entry points, then verify local deep links,
   navigation, and release-build output.

Rollback restores hash router configuration and its corresponding helpers; no
deck content or external data is altered.
