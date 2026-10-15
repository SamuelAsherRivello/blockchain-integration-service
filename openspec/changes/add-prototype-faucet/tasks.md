# Tasks

## 1. Package and development scaffolding

- [x] 1.1 Add `BIS/packages/prototype-faucet/` as an npm workspace package with browser and server entry points, and verify the workspace can resolve the package without changing `@bis/integration` exports.
- [x] 1.2 Add the prototype route to the shared Vite development configuration and verify the existing Admin, Marketplace, Onboarding, and Integration routes remain reachable.
- [x] 1.3 Add `prototype-faucet-package-readme.md` documenting its experimental status, local commands, Arkade-only scope, required environment variables, and no-secret handling; verify every documented path and command exists.

## 2. Network and address validation

- [x] 2.1 Implement isolated Signet and Mutinynet faucet network definitions using the existing Arkade operator URLs and safe public metadata; verify unit tests reject operator network mismatches.
- [x] 2.2 Implement Arkade address decoding and selected-network operator-identity validation; verify tests cover valid addresses, malformed addresses, and cross-network addresses without relying only on the `tark1` prefix.
- [x] 2.3 Implement the allowlisted 50,000/100,000/200,000-sat amount policy and effective operator/configured ceiling; verify tests block unsupported, zero, negative, and over-limit amounts before submission.
- [x] 2.4 Add client-side form validation and accessible network, address, amount, and status controls; verify the browser fixture prevents invalid submission and renders the prototype-only labeling.

## 3. Protected faucet service

- [x] 3.1 Implement server-only environment loading for per-network faucet wallet configuration and fail-closed startup validation; verify tests and static inspection show no secret values enter client output or committed files.
- [x] 3.2 Implement the server request boundary with repeated network/address/amount validation, sanitized typed errors, and no raw provider payloads in responses; verify API tests cover validation, unavailable configuration, and provider rejection.
- [x] 3.3 Implement idempotency and per-client/per-destination rate limits with configurable ceilings; verify repeated requests do not create duplicate sends and limited requests return safe rate-limit responses.
- [x] 3.4 Implement Arkade wallet submission and bounded public-operation verification; verify mocked tests distinguish accepted-pending, verified-success, rejected, and unavailable outcomes.
- [x] 3.5 Document the local server start command and environment configuration without including credentials; verify a clean checkout can start in mock mode with no funded wallet.

## 4. Faucet UI and truthful workflow

- [x] 4.1 Connect the page to the faucet API client with request serialization, cancellation/replacement protection, and safe status mapping; verify UI tests cover pending, success, failure, unavailable, and rate-limited states.
- [x] 4.2 Display exact selected network, amount, destination summary, and public operation identifier only when available; verify the page never labels an acknowledgement as confirmed delivery.
- [x] 4.3 Exclude ordinary on-chain BTC controls and recovery-material inputs from the page; verify rendered output contains Arkade-only funding controls and no secret-entry surface.

## 5. Integration verification

- [x] 5.1 Add the prototype package to the repository's appropriate typecheck/build scripts and verify `npm run typecheck` and the package build pass in mock mode.
- [x] 5.2 Add a shared development-server smoke check for `/prototype-faucet/` and verify all five package destinations return the expected page content.
- [x] 5.3 Run the complete relevant unit/API/browser test set and record privacy-safe diagnostics under `output/reports/prototype-faucet/`; verify no secrets, recovery material, or raw provider payloads are written.
- [ ] 5.4 Perform a controlled live Arkade test only after explicitly configuring funded faucet liquidity, then verify the selected destination receives the exact bounded amount on the selected network without claiming success before public verification.
