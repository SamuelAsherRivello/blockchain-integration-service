# Design

## Context

See proposal.md for motivation. At checkpoint d138e3a, Marketplace asks getPaymentRecipient separately from the context's prepared address cache, explicitly refreshes a Game controller that already subscribes to Player session changes, and uses module-global Player address fallback. loadAddresses(session) awaits full Wallet.create and adapter readonlyView (which awaits getContractManager). SDK Wallet.create waits getVtxoManager before returning; addresses themselves derive from identity and validated operator configuration using DefaultVtxo.Script and BoardingContractHandler. Game inspect already publishes addresses before balance completes.

## Goals / Non-Goals

Make the address path short without creating another SDK wallet or storing live wallet facts. Preserve existing ownership/funding/recovery safety. The one-second test measures cold navigation including local hydration and page rendering with a stated operator response budget; it is not an unconditional network SLA.

## Decisions

1. Add an ephemeral address projection promise to the existing role slot. Its existing provider configuration read validates the network and supplies public SDK script derivation. Address borrowers use the same role/account/operator checks, detached cancellation, deadline, and retirement signal. Full wallet acquisition proceeds normally. Completed normal-wallet addresses are a compatible fallback, never a separate wallet. Keep projection helpers private to the adapter boundary.
2. Derive Arkade and boarding addresses with exported SDK primitives using the identical primary identity and timelocks seen in installed SDK setupWalletConfig. Verify exact equivalence against normal wallet construction. No hardcoded operator keys, custom address encoding, persisted address cache, or second ReadonlyWallet. Identity derivation remains local; operator configuration remains required.
3. Reuse prepared Player addresses in getPaymentRecipient while retaining active-account and version checks. Remove App's redundant Game refresh effect; the existing controller owns automatic session refreshes. Scope display results to profile/network and local cancellation. Replace global fallback with explicit role-local label state; a connected Game address displays without waiting for catalog, while public inventory still honors its existing catalog and scope rules.
4. Browser acceptance uses isolated contexts and public test mnemonics with synthetic read-only operator/indexer responses. Delayed balances/assets establish that labels are independent. Cold first navigation and reload record both labels within 1,000 ms; identity/network/logout/failure cases verify truthfulness. Separate live-provider timing uses the same isolated public vectors, never private user wallets. Reuse shared port 5174, or start a test-owned ephemeral Vite server and warm its compilation graph in a separate guest context before measuring a cold browser context. No wallet vault access, transaction, shared-server restart, or package install.
5. Address consumers start the role's bootstrap configuration request concurrently with local identity key derivation. The first SDK configuration call consumes that exact promise once, including after it resolves; subsequent configuration reads remain live. This removes a serial wait without adding a wallet or duplicate initial configuration request. Completed wallet address reads retain the usual borrower lease. Player presentation resets on each profile/network effect, including A-B-A transitions; public Game fallback waits for local hydration to report empty.
6. Context consumers share only an in-flight saved-account validation with identical context version and storage revision. Settlement and invalidation clear it; sequential reads still decrypt and validate current storage, and the existing revision retry loop and caller generation/profile checks remain. Marketplace recipient validation and prepared addresses begin together. Bootstrap I/O starts before synchronous mnemonic construction as well as asynchronous key work. Browser timing evidence is saved on assertion failure and includes first label element, paint, document readiness, and public configuration request timing.

## Risks / Trade-offs

- SDK address configuration semantics could change: parity tests pin current behavior and fail on drift; no handwritten encoding.
- Address projection can succeed while full ownership initialization fails: labels are identity presentation only; operation checks remain unchanged.
- Slow operator configuration can exceed one second: retain honest Loading/Unavailable and report actual provider timing; do not lower deadlines to fake completion.
- Concurrent source work: coordinator reserved these seams after a stable checkpoint; keep a narrow scoped diff and hand back before export/push.
