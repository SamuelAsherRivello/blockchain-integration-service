# Tasks

## 1. Define and enforce the BIS style boundary

- [x] 1.1 Inventory production BIS selectors and inherited visual properties under `BIS/packages/integration/src/client/ui-layer-react/`, identify the protected typography and control properties, and verify the inventory against the `bis-ui-style-isolation` requirements.
- [x] 1.2 Update the BIS root and descendant styles so production views explicitly own protected typography, casing, spacing, color, alignment, and control presentation without changing view content, navigation, or accessibility behavior; verify existing integration UI tests pass.
- [x] 1.3 Add or update focused BIS style tests for headings, field labels, balance labels, action buttons, and Back/navigation controls; verify the tests pass in the integration package.

## 2. Remove host-to-BIS style coupling

- [x] 2.1 Audit Admin and Marketplace CSS for broad selectors or `.bis-*` overrides, remove or scope rules that alter BIS internals, and verify Marketplace-specific catalog styling remains unchanged through its existing client checks.
- [x] 2.2 Preserve and test documented launcher placement, host-container sizing, stacking, and open-dialog centering behavior; verify account-entry and Admin dialog tests pass.

## 3. Verify presentation across contexts

- [x] 3.1 Add representative Admin-like, Marketplace-like, and game-host style fixtures that render the same BIS view and compare protected computed-style properties; verify equivalent properties match at the supported scale.
- [x] 3.2 Run the full relevant integration, Admin, Marketplace, and smoke verification commands, including loading and account-dialog checks; verify no host-specific visual exception remains and document any intentionally responsive geometry differences.
