# Tasks

## 1. Cache contract and inventory coordinator

- [x] 1.1 Define the versioned public inventory cache envelope, wallet-role/network/profile keying, 30-second freshness rule, malformed-entry handling, and best-effort localStorage adapter; verify unit tests reject cross-wallet, cross-network, expired, malformed, and secret-bearing records.
- [x] 1.2 Add the dual-wallet inventory coordinator that starts eligible Player and Game reads concurrently, retains independent pending/success/empty/unavailable states, and preserves chain classification; verify focused coordinator tests cover both reads resolving in either order and one wallet failing independently.
- [x] 1.3 Add cache-first behavior without duplicate provider reads or empty-state flicker; verify tests reuse fresh records, trigger reads after expiry or explicit retry, and preserve the other wallet’s active result.

## 2. Marketplace presentation and failure behavior

- [x] 2.1 Replace the single Game inventory loading flag in `MarketplaceContent` with the selected-wallet projection from the coordinator; verify Player and Game tabs hide loading independently and rapid tab switches do not duplicate reads.
- [x] 2.2 Add explicit selected-wallet unavailable feedback and retry behavior; verify provider failures show an error prompt instead of loading or an empty inventory and do not expose raw SDK errors.
- [x] 2.3 Persist and hydrate both wallet snapshots through the cache across page reloads and new tabs; verify fresh results render immediately within 30 seconds and expired entries trigger reads.
- [x] 2.4 Preserve ownership labels, item detail, checkout eligibility, catalog filters, and Game Wallet address override behavior; verify existing Marketplace catalog and trading tests remain green.

## 3. Integration verification and documentation

- [x] 3.1 Update Marketplace cache/loading tests and package documentation with the public cache scope, 30-second freshness, selected-tab prompt, and error behavior; verify examples contain no wallet secrets.
- [x] 3.2 Run focused Marketplace tests, BIS typecheck, Marketplace production build, and the full relevant test suite; verify no existing wallet, asset, or checkout behavior regresses.
- [x] 3.3 Run the shared Vite preview and verify both wallet tabs, refresh, page reload, and new-tab cache reuse with Playwright; the tracked 30-second loading counter asserts exactly one show and one disappearance; focused coordinator tests verify expiry and selected-wallet retry behavior; retain non-secret artifacts under `output/playwright/fix-marketplace-cache/`.
