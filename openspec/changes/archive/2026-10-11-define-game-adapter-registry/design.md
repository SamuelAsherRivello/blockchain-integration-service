# Design

## Registry contract

`BIS/scripts/test-wallets/game-adapter.mjs` owns the immutable adapter definition. It exposes the game application name, path, muted query parameters, and public package provenance. The origin is supplied by the operator and normalized with the runner's existing exact-loopback-origin validator; the adapter never accepts an arbitrary origin from the game evidence.

The game entry is stored in the vault as `{ app, origin, path, search, provenance }`. Registration is idempotent for an identical entry and does not overwrite a changed entry. `OwnedBrowser` resolves an application through this registry and rejects unsupported or unregistered adapters before loading wallet material.

## Launch and validation

The runner navigates the game to the exact registered URL, including the two evidence-backed mute parameters. Navigation interception permits only the selected origin. Inspection revalidates origin, pathname, and search before exposing a public result. A changed port therefore requires explicit re-registration and cannot reuse the old application row.

## Provenance

The registry requires package name `@bis/integration`, version `0.0.20`, artifact SHA-256 `4de67c29df5ebdd25e8f47b30eac9c7ad5f0d602e3f4b94f57f18989672e6329`, and evidence path `stealth-steel/vendor/BIS_PROVENANCE.md`. Verification is a pure text check against a supplied public evidence document, so BIS tests can use a disposable fixture and do not need the companion repository or a package install. No private package or wallet data is read.

## Boundaries

This is a registry/configuration seam, not live game acceptance. It does not copy storage, export recovery phrases, add a signing path, or pretend that the companion game's Account UI is already proven by BIS tests. The parent change remains responsible for game restoration and live acceptance.
