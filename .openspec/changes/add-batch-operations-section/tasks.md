## 1. Local Admin batch-session controls

- [x] 1.1 Add the demo-local `BatchOperationsPanel` using the existing foldable Admin section and story-card primitives; implement the exact `04. Batch Operations`, `Clear Last Batch`, and `Start New Batch` text, in-memory start/replace/clear state, initial Clear disablement, and a synchronous duplicate-action guard; verify it has no wallet, Arkade, storage, or game-facing API dependency.
- [x] 1.2 Compose the panel after Marketplace and before Console through the current Admin composition path; add the bounded App Console append callback and verify each start, replacement, and clear entry is explicitly local and contains no wallet, asset, address, or remote-operation claim.

## 2. Documentation and automated coverage

- [x] 2.1 Update the Admin/user-story documentation and integration-demo README to describe the Batch Operations section as an Admin-local state tool, preserve the requested exact labels, and state that it does not start, clear, or cancel a wallet/Arkade/Marketplace batch; verify headings and links remain valid.
- [x] 2.2 Add a focused isolated React/browser-host fixture for the new panel; verify exact order, initial and post-action enablement, start/replace/clear Console feedback, Enter/Space activation, same-turn duplicate protection, no active-wallet requirement, reload reset, and narrow no-overflow behavior without invoking a wallet callback.

## 3. End-to-end verification

- [x] 3.1 Run the focused fixture and the repository test suite; verify the new local-only controls do not regress existing Admin Marketplace and Console behavior.
- [x] 3.2 Run typecheck and production builds for the integration and demo packages, then verify the real Admin page in a browser at wide and narrow viewports with keyboard focus; capture only non-secret output artifacts under `output/`.
