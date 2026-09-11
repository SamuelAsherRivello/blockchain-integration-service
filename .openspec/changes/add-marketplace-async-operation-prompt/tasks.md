## 1. Shared BIS pending presentation

- [ ] 1.1 Export the minimal shared Pending Operation Dialog composition needed by a React host from `@bis/integration`, without changing existing BIS consumers; verify integration UI/package-boundary tests prove the public boundary renders the existing dialog, bolt, backdrop, focus behavior, and reduced-motion rule.
- [ ] 1.2 Keep the shared dialog host-scoped and confirm it remains compatible with the Marketplace's separately mounted Account UI; verify a focused render test covers the intended host and overlay stacking contract.

## 2. Marketplace async lifecycle

- [ ] 2.1 Compose Marketplace inside the shared BIS pending boundary and connect initial catalog plus required visible inventory preparation to it; verify initial load shows the centered darkened prompt instead of an inline Loading result and reveals the prepared Marketplace only when data/render state is ready.
- [ ] 2.2 Add foreground lifecycle state for Buy, Sell, and explicit checkout reconciliation before their first await, update only with `ing...` operation labels, and keep it active through terminal confirmation plus required wallet/inventory/equipment refresh and rendered ready state; verify focused Marketplace tests cover each action and do not expose duplicate local spinner/backdrop markup or CSS.
- [ ] 2.3 Route foreground failures through the shared terminal error treatment and return durable unconfirmed checkouts to the existing exact-item recovery state; verify tests prove no false completed trade, no settlement-length overlay, and no duplicate conflicting item action while unrelated safe Marketplace interactions remain available.

## 3. Accessibility and end-to-end verification

- [ ] 3.1 Add focused integration and Marketplace tests for immediate prompt visibility, centered dark translucent backdrop, non-interactive covered controls, focus containment, reduced motion, initial preparation, Buy, Sell, reconciliation, terminal error, and unconfirmed recovery; verify the focused test commands pass.
- [ ] 3.2 Run workspace typecheck and builds with `npm run typecheck` and `npm run build`; verify they pass without new dependencies and save any non-secret diagnostics only under `output/`.
- [ ] 3.3 Run the Marketplace in a real browser and verify the prompt's centered BIS styling, darkened background, stacking over the mounted Account host, action blocking, refreshed success reveal, and nonblocking unresolved-item recovery; save non-secret browser evidence under `output/`.
