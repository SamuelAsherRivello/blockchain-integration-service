# Automated LTO browser acceptance

`lto-browser-fixture.html` is an isolated test fixture. Every financial outcome is simulated and labeled as such. It uses the real LTO service and encrypted browser storage, but no saved user signer or actual operator. It is excluded from the demo production build inputs.

With the BIS Vite demo running, execute:

```text
node BIS/packages/integration-demo/tests/lto-browser-check.mjs
```

The script resolves an already installed `playwright` package. If it is supplied by a separate tooling runtime, set `BIS_PLAYWRIGHT_PACKAGE` to that runtime's absolute package.json path. `BIS_DEMO_URL` optionally changes the default `http://127.0.0.1:5174/`. It creates fresh isolated profiles and blocks all requests outside that origin. No manual clicks or live funding are required.

The normal Node test suite also includes `lto-simulated-operator.test.mjs`, which constructs and signs real SDK transactions against an in-process operator with external fetch blocked. This checks adapter execution and recovery without using real funds. It does not establish unobserved live Signet outcomes. Production creation is enabled by default and validates real provider/wallet conditions on each operation.

The browser suite also opens two pages in one isolated profile to exercise shared IndexedDB and actual Web Locks. Pending funding blocks the second host session; the second session cannot adopt the first session's offer or submit a claim. Pending claim state disables both account actions in the other tab, and verified terminal state removes the contract there. The skipped session stays skipped after resolution.

`lto-public-factory.test.mjs` covers the actual public factory with isolated storage/provider boundaries: default creation and Claim, explicit disabled creation, and retained query/session-end refund. A separate funded probe page is optional diagnostic tooling and is not needed to use Start LTO or Claim LTO.
