# Tasks

## 1. Canonical route helpers and callers

- [x] 1.1 Replace the overloaded manifest slide-path helper with explicit deck-base and hash-canonical browser URL helpers; verify focused manifest tests assert `base#/N` and reject pathname slide suffixes.
- [x] 1.2 Update the launcher, supervisor, readiness/coherence verifier, and Mondrian theme navigation to use the correct base or canonical browser helper; verify no local generated route contains both pathname and hash slide positions.
- [x] 1.3 Update local Slidev preview documentation to explain the deck-base plus hash route contract; verify every documented local deck link uses the canonical form.

## 2. End-to-end canonical navigation verification

- [x] 2.1 Add browser coverage that opens a canonical deep link, confirms the declared deck and slide, then advances navigation while only the hash changes; verify the focused live-preview test passes.
- [x] 2.2 Run manifest, proxy, and live-preview fast verification and inspect their reports; verify declared deck ownership, HMR readiness, and canonical route output remain valid.
