# Account Details addresses verification

- Added three test-first cases in `packages/integration/tests/addresses.test.mjs`: details-only loading independent of balance failure, refresh failure/recovery, and cancellation/disposal of late results. Confirmed all three failed before implementation and passed afterward.
- `node --experimental-strip-types --test packages/integration/tests/*.test.mjs`: 44 tests passed, including the concurrent funding tests.
- `npm run build`: typecheck and both package builds passed; existing large-bundle warning remains.
- Browser fixture `/tests/addresses-host.html`, 300 x 540 host: PASS for full address values, exact clipboard payload, copy success, denied-copy fallback, no horizontal overflow, refresh failure/retry, Back clearing, and absence of invoice UI. Fixture values are isolated test doubles, not payment destinations or transaction results.
- Live `loadAddresses` call with a transient generated identity: Signet Arkade address (115 characters) and Bitcoin boarding address (62 characters) returned successfully. No recovery material printed, wallet persisted, or payment made. Node reported its expected EventSource fallback warning.
- Runtime uses the same Account Details UI through the existing A4 Admin demonstration. Lightning is documented as deferred D2, without adding a dependency or invoice control.
