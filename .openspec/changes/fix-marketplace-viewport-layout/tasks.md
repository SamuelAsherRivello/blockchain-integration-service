## 1. Marketplace viewport layout

- [x] 1.1 Replace Marketplace’s transformed desktop Account layer with distinct lower-left closed-launcher and centered open-dialog rules; verify the open layer has no transform.
- [x] 1.2 Keep desktop catalog density in local grid/card rules and preserve the existing small-screen fallback; verify the Marketplace CSS contains no desktop transform that reduces the Account overlay.

## 2. Verification

- [x] 2.1 Run the Marketplace build and verify it completes successfully.
- [x] 2.2 Run the Marketplace in a real desktop browser at the supplied reference scale; verify the Account button is fully visible lower-left, then verify Account opens with a full-viewport shaded backdrop and a centered dialog.
