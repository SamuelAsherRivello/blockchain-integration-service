# Tasks

## Current finite release acceptance

The user added final step 9 to finish and vet all four Treasure Hunt pages. The standalone SDK lifecycle is implemented but has not passed funded live acceptance; historical BIS-based/UI-only passes below do not complete it. Follow the six-step local implementation/acceptance order in design.md. Sandbox implementation and local vetting precede coordinated publication; final public checks close step 9. Preserve all existing task IDs and recovery.

Task 1.1 verifies Setup Wallet 2 through the standalone Arkade SDK with no BIS Account/login/service. Task 1.2 must replace all four operation placeholders with the real canonical compiled contract lifecycle. Task 1.3 proves explicit fresh evidence, same-session identity and duplicate/unknown behavior. Tasks 3.1–3.3 require standalone SDK source checks and separate real Signet/Mutinynet receipts, including Create→Check→Claim, a separate Create→Check→Reject/refund, expiry and reload/recovery. Buttons/source/navigation alone cannot pass them.

## 4. Final Sandbox release closure

- [ ] 4.1 Vet the complete four-page flow against the final coordinated candidate and record each page's actual supported result, exact live contract/transaction receipts, source-format/security checks and preserved Conditional Vault behavior; fix every supported-path placeholder or regression before publication.
- [ ] 4.2 After the existing release workflow succeeds, verify public demo-22, demo-23, demo-24 and demo-25 routes, exact release identity and coherent shared lifecycle; finalize step 9 only when supported real actions and recovery pass, with historical unresolved operations unchanged.

## 1. BIS profile and contract API integration

- [x] 1.1 Use the existing Setup Wallet 2 and standalone Arkade SDK wallet workflow, without a BIS Account, login or service.
- [x] 1.2 Implement the real Treasure Hunt contract Create, Check, Claim and Reject operations directly through the SDK, with durable recovery and no fabricated outcomes.
- [x] 1.3 Query network evidence on each explicit action and test duplicate starts, uncertain outcomes, and ineligible Claim/Reject operations.

## 2. Sandbox demo presentation

- [x] 2.1 Add Treasure Hunt Create, Check, Claim, and Reject routes under the Smart Contracts navigation group beside Conditional Vault; selecting the group opens Create, and all existing Conditional Vault routes remain available.
- [x] 2.2 Add step-specific actions with the shared Execute/network button, no client-side action gating, network contract guarantees disclosed outside Input, and evidence-derived pending, terminal, and unavailable states; align Input rows and Docs content with established sandbox demo patterns.
- [x] 2.3 Register source, overview, sequence diagram, explorer references, and package README documentation; verify the rendered executable source has exactly the Arrange, Act, Assert sections in order and that documentation matches the implemented controls and capability limits.

## 3. Contract acceptance and evidence

- [ ] 3.1 Run the focused Prototype Sandbox deterministic suite and package typecheck/build against the standalone SDK implementation; record deterministic results separately from any live transaction result.
- [ ] 3.2 Perform funded Signet and Mutinynet lifecycle checks only where the standalone SDK/contract capability check exposes support; record exact network, contract profile, operation references and receipts, and verify unsupported networks fail closed without claiming live acceptance.
- [ ] 3.3 Verify the finished standalone SDK demo in Edge, including that every step remains clickable and uses shared Execute/network controls, plus continued availability of Conditional Vault.

## Current implementation audit (2026-10-30)

Tasks 1.1–1.3 are complete at the implementation and deterministic-verification level. The active demo reads the selected network's Setup Wallet 2 and opens the standard Arkade SDK wallet without a BIS Account/service. `treasure-sdk.ts` uses the canonical compiler and actual SDK funding/claim/refund transactions; encrypted recovery, original scope/deadline, exact receipt inspection, duplicate-start protection and uncertain/ineligible outcomes have focused coverage. Commits `552ceb16` and `7b748c55` provide the source implementation and shared wallet-reservation fix. These checked implementation tasks do not assert funded network acceptance.

The complete non-browser Sandbox suite passed 201/201 against frozen `3edc0017` plus the corrected stale Treasure source assertion. Current `73987fce` plus the scoped helper/type/assertion fixes passes 202/202, including native SDK onboarding preparation with an in-process synthetic wallet. The narrow Events/source/presentation/registry suite passed 22/22. External network requests were blocked in these accepted deterministic runs. The current Sandbox production build passed. Reports are under `output/reports/treasure/sandbox-regression-3edc0017-2026-10-30/` and `output/reports/treasure/sandbox-regression-73987fce-2026-10-30/`.

Task 3.1 stays open: a strict check of the same common entry files reports 31 identical pre-existing diagnostics at clean `7b748c55` and at the current candidate after fixing all 20 introduced Sandbox helper diagnostics. The remaining baseline comprises faucet-core (27), network-config (3), and Events monitor network indexing (1). Compiler flags were not weakened; the full strict invocation is not green. Exact commands, messages and comparisons are retained separately from the earlier narrower green engine check.

Tasks 3.2, 3.3, 4.1 and 4.2 remain open. Earlier wallet-free/limited Edge observations do not establish the latest candidate's complete funded lifecycle, final-candidate acceptance or public release. The historical supplied wallet's unresolved Signet cleanup and Mutinynet increment records remain unchanged. No new live receipt or network qualification is claimed by this audit.

## Verification note (2026-10-29)

Deterministic Prototype Sandbox tests passed 181/181 with browser tests excluded; the explicit BIS validation-mode tests passed 23/23. Root TypeScript checking and the Prototype Sandbox build passed, and the build emitted `dist/demo-22/index.html`. No funded Treasure Hunt transaction was attempted. The last protected acceptance record (2026-10-28) reported Signet operation `clean-signet-mvrlrrg6-recover` unknown for 2,000 sats with no fee, provider ID, transaction receipt, or recorded input outpoint. The sandboxed AppContainer vault path was empty; a fresh protected host-vault budget check is recorded below and refused both networks. Do not fund until a fresh protected preflight admits the exact slot and the unresolved exposure is accounted for.

Earlier attempts could not reach the shared Vite route and an isolated launcher at port 5236 timed out; the isolated session was closed after those probes. The shared route later became reachable on port 5174. No pre-existing shared listener was stopped or replaced.

## Documentation and source verification (2026-10-29)

Treasure Hunt source registration, overview, sequence diagram, and BIS-returned explorer references are present. The demo panel renders the registered raw source through its line renderer; focused deterministic checks passed 8/8, including the exact Arrange/Act/Assert section order. The package README is 650 words and documents the current Signet browser-policy mode and Mutinynet modes with their stated limits. Source-panel content was also inspected in the rendered browser page.

## Shared Vite browser verification (2026-10-29)

The shared Vite route `http://127.0.0.1:5174/prototype-sandbox/demo-22/` returned HTTP 200 and rendered the Treasure Hunt title, Smart Contracts navigation beside Conditional Vault, validation-mode selector, and executable source with Arrange, Act, and Assert sections. The sequence diagram uses the existing Client (L3) participant to represent Player, Sandbox, and BIS, with only Client-to-Arkade and Arkade-to-Client messages. `node --test BIS/packages/prototype-sandbox/tests/browser-treasure-hunt.test.ts` passed 1/1 against shared port 5174. It verified disabled actions without eligible profiles, reload of an expired unresolved attempt without enabling Claim/Reject, network mismatch disabling Check, and continued availability of Conditional Vault routes 14 and 17. This used an isolated browser context and made no wallet or contract request.

The sandboxed AppContainer vault is empty, and the separate protected host-vault budget preflight refuses both networks, so the funded Signet/Mutinynet lifecycle checks remain unperformed. The browser proof is not live contract acceptance.

## Follow-up demo consistency audit (2026-10-29)

Treasure Hunt source now uses the sandbox's divider-style Arrange, Act, and Assert headings. Arrange places imports first, the recovery-storage read next, and remaining setup after a blank line. The four step routes retain the shared Overview/Input/Demo/Output structure and Docs treatment. Focused navigation, source, and browser checks passed 16/16; the Prototype Sandbox build passed. The browser check made no wallet or contract requests. Funded acceptance remains open under task 3.2.

Input displays the existing Setup Wallet 1 address and masked Wallet 2 mnemonic using the same read-only fields as other demos. The demo restores Wallet 2 as the distinct BIS Game Wallet on each explicit action; the BIS Player role remains managed in Account. The network-default validation mode is read-only context rather than an input choice.

## Follow-up wallet and input update (2026-10-29)

The public BIS facade now exposes Game Wallet restoration for the demo, which passes Setup Wallet 2's mnemonic to the existing encrypted Game Wallet import path only after an explicit action. The Treasure session and result output continue to hold no mnemonic. Player readiness gates action availability; after import, the resulting distinct same-network Game Wallet and BIS contract capability are verified before any contract operation. The mode selector is removed; the network default remains visible and is sent explicitly.

## Follow-up verification (2026-10-29)

The Prototype Sandbox non-browser deterministic suite passed 184/184; the BIS Game Wallet, facade, and Treasure Hunt suites passed 64/64. Root TypeScript checking and the sandbox production build passed. The dedicated shared-browser Treasure Hunt test passed 1/1, covering read-only mode display, masked Setup wallets, disabled actions without Player readiness, refresh/reopen of an unresolved session, network mismatch guidance, and Conditional Vault availability. A focused source test confirmed the Treasure sequence diagram has only Client → Arkade Operator and Arkade Operator → Client messages, with no Client self-loop. Browser verification made no Wallet 2 restoration or contract request. The aggregate `npm test --workspace @spike/prototype-sandbox` remains red because unrelated browser/UI tests fail in this already-dirty checkout; several cannot launch without the Playwright Chromium binary, and one source-links fixture resolves a duplicated package path. The focused Treasure Hunt checks pass. Funded lifecycle acceptance remains unperformed under task 3.2 because the recorded protected budget guard refuses both networks.

## Fresh protected budget preflight (2026-10-29 04:50 UTC)

The existing protected host vault was read through its `Vault` API, and the pure acceptance budget guard was run for a 1,000-sat Treasure Hunt intent on each network at a zero-fee lower bound. It returned `acceptance-budget-unverified` for both Signet and Mutinynet. This does not admit either funded lifecycle; no wallet was attached, no provider was queried, and no signing or transaction request was made. The remaining live acceptance task stays open pending reconciled fee/operation evidence and a fresh guard result that admits the exact slot and its fee ceiling.

## Follow-up operator-driven actions and restoration diagnostics (2026-10-29)

Removed Treasure demo-owned browser session persistence and all offer/wallet readiness gating from its four action buttons. Each route uses the shared Execute button with the selected network on the second line. Start first reconciles matching BIS contract records to avoid replacing an unresolved offer; Check, Claim, and Reject query BIS/operator state at execution time, and writes depend on the returned contract eligibility. Input now contains only the read-only Setup Wallet 1 address and masked Wallet 2 mnemonic. BIS wallet restore returns a safe failure reason so the output explains why Setup Wallet 2 could not be imported. Focused deterministic tests passed 14/14; the browser test passed 1/1; root TypeScript checking passed, the BIS facade test passed 25/25, and the Sandbox production build passed. Live funded network acceptance remains unperformed as detailed above.

## Wallet restore relay fix (2026-10-29)

The shared local Vite route returned 404 for `/api/bis/arkade/signet/v1/info` because `bis-server` middleware checked optional signer configuration before dispatching the bounded read-only Arkade relay. Treasure Hunt restores through BIS and therefore failed where other demos connected directly. Moved only the allowlisted read relay ahead of the signer gate; signer write routes remain gated. A no-browser middleware test passed with the signer disabled, and a fresh local Vite instance returned HTTP 200 with `network: signet` from the same endpoint. The existing shared Vite process still has its pre-change middleware loaded and must be restarted before that already-running preview reflects this fix; it was left running.

## Same-wallet follow-up (2026-10-29)

The Treasure facade explicitly enables same-wallet test roles, keeps its Game Wallet selection in a separate encrypted store, and retains contract journals in the shared recovery store. The opt-in is recorded in contract scope and recovery terms; default BIS creation still rejects matching roles. Deterministic checks cover wallet selection, compiled Signet and Mutinynet scripts, same-wallet lifecycle transitions, encrypted reload, portable recovery, and retained production role separation. These checks do not establish live settlement.

In Edge on Signet, Check, Claim and Reject restored the supplied wallet and returned no matching offer. A protected ledger comparison identified the same wallet in Signet refund `clean-signet-mvrks476-initial` (2,074 sats, unknown, no provider ID) and Mutinynet operation `vault-mutiny-proof-d-increment-1` (unknown). The saved Signet cleanup report contains no terminal receipt. Both reservations remain intact. No new offer or competing spend was submitted, and task 3.2 remains open until the original operations are reconciled and a funded lifecycle is verified.

## Standalone SDK correction (2026-10-29)

The user clarified that Treasure Hunt must use the same standalone SDK workflow as other prototype demos, without BIS Account/login/service dependencies. The former BIS-based implementation and its same-wallet integration changes have been removed from the active page. The page now uses `demoCreateWallet` with Setup Wallet 2 and explicitly reports contract operations unavailable until the standalone lifecycle is implemented. The earlier BIS verification notes above are historical and do not establish completion of the replacement.

The sandbox then contained a standalone SDK lifecycle and encrypted recovery journal using Setup Wallet 2 for both roles. Fourteen focused offline tests passed, including SDK signing against a synthetic operator on both network configurations; typecheck and the sandbox build also passed. These do not establish live contract execution. In Edge on Signet, Check, Claim and Reject restored the provided wallet and returned without a BIS account prompt, but no Treasure recovery record was present and no contract spend was made. The original Signet cleanup and Mutinynet vault operations remain unknown. A fresh exact Mutinynet lookup found no archived candidate and the original input was swept without a recorded spender; this is not terminal evidence. Preserve both reservations and complete funded Edge acceptance only after they are reconciled. The 90-second eligibility rule is browser-enforced and can be bypassed by a modified client.

The saved Mutinynet increment request compiles to transaction `3c420a877880e371fa3a1597eb287d3ac6c705e1d0bac071c0bde4ca62256c15` and its checkpoint references the original funded output. The operator returned no transaction for that ID; the original output was reported unspent and swept. Neither observation proves a terminal outcome, so the reservation remains unknown. The Signet cleanup report has no attributable receipt or original inputs, and no matching protected browser journal was found. No reservation was cleared and no new transaction was submitted.
