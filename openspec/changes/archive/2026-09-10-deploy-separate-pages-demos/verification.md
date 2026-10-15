## Release verification

- `npm run build`: passed type checking and all three package production builds.
- `npm run stage:pages`: staged Admin, Marketplace, and retained immutable artwork at `output/pages/deploy-separate-pages-demos/blockchain-integration-service/`.
- `npm run verify:pages`: passed a headless Microsoft Edge check of the staged `/blockchain-integration-service/admin/` and `/blockchain-integration-service/marketplace/` routes, Marketplace catalog, and an existing root artwork URL.
- `openspec validate deploy-separate-pages-demos --strict`: passed.

## Known limitation

`npm test` has one unrelated existing failure in `BIS/packages/integration-demo/tests/documentation.test.mjs`: it expects a `302` redirect for `BIS/documentation/user-stories/`, but the Vite development server returns `200`. The test does not exercise either published Pages route. The browser-profile test passes when using the installed Edge channel; the default managed Playwright Chromium is not installed in this environment.
