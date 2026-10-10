# Tasks

## 1. Centralize the BIS backdrop treatment

- [x] 1.1 Add shared BIS backdrop color and blur custom properties in `overlay.css`, using the existing normal BIS backdrop values as the baseline, and verify the stylesheet contains one source of truth for both values.
- [x] 1.2 Apply the shared backdrop properties to `.bis-layer-open`, `.bis-pending-backdrop`, and `.bis-confirmation::backdrop` without changing their positioning, z-index, pointer, or focus behavior; verify each selector resolves to the same opacity and blur treatment in the compiled CSS.

## 2. Verify consistent overlay behavior

- [x] 2.1 Extend the integration backdrop or pending-operation tests to assert that normal, pending, and confirmation backdrop styles use the shared configuration and that the foreground pending dialog remains separately styled; verify the focused tests pass.
- [x] 2.2 Run `npm run typecheck`, the integration production build, and the relevant integration tests, and verify no loading, confirmation, or reduced-motion regressions are reported.
