# BIS 0.0.23 regression fixture

`bis-integration-0.0.23.tgz` is the authentic public `@bis/integration` package
previously vendored by Stealth & Steel. It was copied unchanged from
`stealth-steel/vendor/bis-integration-0.0.23.tgz` on 2026-10-26 so BIS-only CI
and future game imports do not depend on that game's installed version.

The archive is **680,797 bytes**, SHA-256
`1ad3cdb15b4d67d23a42addedb921999aff30bde694f0bc6a5bb546995aceace`.
It contains 149 regular files. Its default export is `./dist/integration.js`.
It contains public source/distribution code and package documentation, with no
wallet storage, credentials or recovery material. Preserve the archive bytes.

`treasure-protected-harness.ts` verifies size and hash before decompression,
validates tar paths/types/checksums, derives each member hash, and extracts into
a unique ignored `output/fixtures/legacy-integration/` directory. Bundling uses
the verified old distribution and explicitly checked dependencies installed in
BIS. The old script source is read from the verified archive, never a current
game install. No adjacent game directory is needed at test time.

The tests establish authentic old-code import, immutable binding checks and
safe extraction. Their synthetic storage data is not a live recovery receipt.
The earlier real Signet legacy funding/refund remains separate historical
evidence; this fixture change does not repeat that financial test.
