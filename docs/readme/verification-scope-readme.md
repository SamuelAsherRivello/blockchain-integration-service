# Verification scope

The default root commands validate the release-supported BIS surfaces. `npm test` runs the integration, Admin, Marketplace, and release-script tests. `npm run build` runs the root type check and builds the integration library, Admin, and Marketplace packages. These are the commands used by the GitHub Pages workflow, which publishes Admin and Marketplace only.

`@spike/prototype-onboarding` remains a separately owned experiment because it uses the Arkade SDK directly and keeps its browser data independent from BIS account storage. Its package already supplies focused `test` and `build` commands. It is served by the shared root preview so developers can inspect all four packages together, but it is not silently included in the release command path.

When a change affects the shared local-preview workflow, workspace tooling, or the onboarding prototype itself, run the explicit aggregate commands:

```text
npm run test:all
npm run build:all
```

Those commands preserve the default release scope and additionally invoke the prototype package’s checks. They do not establish live wallet or network acceptance. Keep recovery phrases, signing material, and private account data out of test output and diagnostics; record live verification only through the project’s privacy-safe documentation process.

For package roles and allowed dependency direction, see [package boundaries](package-boundaries-readme.md).

[Back to the main README](../../README.md)
