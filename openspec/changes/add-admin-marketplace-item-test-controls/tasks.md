## 1. Exact asset-delivery boundary

- [ ] 1.1 Add validated, JSON-safe exact-asset delivery request/result types and a durable sender/recipient/asset/input journal with reservation and reconciliation helpers; verify focused unit tests cover invalid/same recipients, repeat IDs, changed holdings, unknown outcomes, and no inferred completion.
- [ ] 1.2 Implement the Signet Arkade delivery adapter using asset-bearing send, constrained selected inputs, exact recipient/change transaction inspection, and fresh recipient-output evidence; verify adapter tests cover exact allocation, preserved unrelated assets, carrier-vs-price presentation, and lost acknowledgement recovery.
- [ ] 1.3 Expose the delivery boundary through `createBisContext`, `createBisGameWallet`, and public package exports without SDK types or secrets; verify typecheck and public-boundary tests pass.

## 2. Test-only Admin item controls

- [ ] 2.1 Add a fresh, one-item Game-Wallet marketplace selector that uses chain classification and exact holdings only; verify component tests reject trophies, generic/malformed assets, stale selection, and unavailable role state.
- [ ] 2.2 Add distinct `Send Item to Player` and confirmed `Burn Item from Player` controls wired to their scoped Game and Player wallet boundaries; verify tests cover exact role use, same-identity rejection, Player holding refresh, explicit burn cancellation, and truthful result logging without secrets.
- [ ] 2.3 Implement asset-and-direction keyed pending/reconciliation state without a panel-wide user lock; verify a pending/unknown item blocks its duplicate action while unrelated controls and an independently safe item remain interactive.

## 3. Preserve the production boundary and verify end to end

- [ ] 3.1 Extend Marketplace/Admin integration tests to prove the Admin test controls neither enable Buy/Sell nor add a sequential payment fallback; verify existing atomic-unavailable gate assertions still pass.
- [ ] 3.2 With already logged-in distinct wallets, perform the authorized Signet test flow: send one selected Game-Wallet item to Player, freshly observe it in Player Assets, then explicitly burn that exact Player item; record public transaction/ownership evidence only and leave no recovery material in logs or artifacts.
- [ ] 3.3 Run focused tests, workspace typecheck/build, OpenSpec strict validation, and a browser smoke test of the Admin controls plus disabled Marketplace Buy/Sell; save non-secret reports under `output/`.
