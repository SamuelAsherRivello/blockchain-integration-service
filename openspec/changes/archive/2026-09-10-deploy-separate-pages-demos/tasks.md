## 1. Publishable application paths

- [x] 1.1 Configure the Admin and Marketplace production bases and base-aware resource paths; verify each production bundle references only its respective `/admin/` or `/marketplace/` path.
- [x] 1.2 Preserve local Vite development behavior for both packages; verify their existing development commands still serve the expected application.

## 2. GitHub Pages artifact

- [x] 2.1 Update the GitHub Pages workflow to stage Admin and Marketplace builds in separate `admin/` and `marketplace/` artifact directories while retaining immutable root `assets/`; verify the workspace build and staging layout complete in CI-equivalent local commands.
- [x] 2.2 Add route-level deployment checks that serve the staged artifact and verify `/admin/` and `/marketplace/` load their correct HTML, scripts, catalog, and static assets.

## 3. Release guidance and publication

- [x] 3.1 Replace the README's single demo link with labeled BIS Admin and BIS Marketplace URLs and update the release steps to require verifying both routes; verify the links match the deployed path contract.
- [x] 3.2 Run the repository test suite, type check, production build, staging route checks, and strict OpenSpec validation; record any limitations before release.
- [x] 3.3 Commit and push the completed release scope, trigger or confirm the GitHub Pages deployment, and verify both public URLs before creating the GitHub release.
