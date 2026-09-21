# Tasks

## 1. Documentation navigation and source wiring

- [x] 1.1 Make the Admin Documentation URL use the active Vite base and verify development navigation resolves to `/documentation/user-stories/` without duplicate path segments.
- [x] 1.2 Add the user-story HTML entry to the integration-demo production build and verify `dist/documentation/user-stories/index.html` is emitted beneath the Admin deployment base.
- [x] 1.3 Preserve the local `BIS/documentation/User Story Diagrams.md` raw import and exclude Vite `/@fs/` source requests from legacy redirects; verify the raw request returns HTTP 200 while the legacy public URL still redirects.

## 2. Regression and browser verification

- [x] 2.1 Update documentation regression coverage for the base-aware Admin link, standalone route, source loading, and legacy redirect behavior; verify the focused documentation tests pass.
- [x] 2.2 Verify the live Vite documentation page renders current story headings and table of contents with no console errors, and verify the Admin regression suite passes.
