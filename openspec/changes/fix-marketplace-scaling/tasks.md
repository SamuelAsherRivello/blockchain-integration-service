## 1. Reconcile Marketplace fluid sizing

- [x] 1.1 Audit the Marketplace CSS import order and consolidate shell, sidebar, toolbar, square card cells, artwork, and typography sizing into the Marketplace-owned fluid layer; verify no legacy fixed-size rule overrides the intended compact hierarchy.
- [x] 1.2 Replace Marketplace viewport width/height media-query layout rules with flex wrapping, grid auto-fit/minmax tracks, bounded fluid values, and normal document scrolling; verify the only remaining Marketplace media queries, if any, are motion-preference queries.
- [x] 1.3 Set fluid header regions for the Signet label, resource controls, and closed Account entry; verify they remain non-overlapping at 1138 by 590, an intermediate viewport, and a narrow viewport.

## 2. Update Marketplace presentation coverage

- [ ] 2.1 Replace the breakpoint-specific Marketplace source assertions with tests for fluid layout primitives, retained catalog semantics, no device-pixel-ratio branch, and no viewport width/height layout media query; verify `npm test` passes.
- [x] 2.2 Add or update the browser verification procedure to capture 1138 by 590 CSS pixels at 100% zoom plus intermediate and narrow stress viewports; verify three square first-row cells, all filters, header controls, and normal scrolling meet the delta spec.

## 3. Validate the scoped change

- [x] 3.1 Run `npm run build --workspace @bis/marketplace` and verify the Marketplace production build succeeds without changing dependencies or wallet behavior.
- [x] 3.2 Review the live Marketplace at `http://127.0.0.1:5173/` with the user at 1138 by 590 CSS pixels and record acceptance before reusing these principles on another product surface.
