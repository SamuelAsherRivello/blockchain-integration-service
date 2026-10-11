# Tasks

Continuation from the completed add-agent-test-wallet-workflow foundation. Checked tasks are inherited delivered baseline; unchecked tasks retain their full acceptance criteria, even where implementation is partial. Do not repeat identity creation, funding or submission merely to rerun acceptance.

## 1. Private inventory and local entry points

- [x] 1.1 Add the `BIS/scripts/test-wallets/` command structure and npm entry point including private import and on-demand empty-account creation, with validated account, network, role, origin and scenario arguments; verify help, invalid input, unsupported-network rejection and absence of default financial mutations in command tests.
- [x] 1.2 Implement Windows-user-protected vault storage outside repository/served roots with restricted permissions, private process pipes, atomic writes and locking; verify DPAPI roundtrip on Windows, permission/protector failure, interrupted writes, and absence of plaintext files or secret output using disposable sentinel data.
- [x] 1.3 Implement private registration of the four supplied accounts, public manifest identity/generation binding, flexible distinct Player/Game assignments and network-specific observations; verify repeated/interrupted import, incompatible recovery format, duplicate identity rejection, role conflict, and mismatched-manifest rejection.
- [x] 1.4 Create `BIS/documentation/agent-test-wallets.md` covering supplied and agent-created test inventory, private import, on-demand empty/funded scenarios, standing permission, local paths and recovery handling; verify help/init/import/status examples against disposable test storage without financial requests.

## 2. Owned browser login and isolation

- [x] 2.1 Implement persistent Playwright ownership per network/pair with a registry for BIS applications and the game, exact origin validation and safe restart/close; verify concurrent ownership, changed-port handling, unrelated-profile preservation and independent origin storage. Register game URLs with muted audio and public package provenance.
- [x] 2.2 Implement private Player-then-Game restoration through production hidden recovery inputs and public identity verification with configurable scenario role assignments; verify both network selections, role conflicts, operator mismatch, restore failure, reload persistence, role reassignment guards and explicit logout without automatic re-login in isolated browser checks.
- [x] 2.3 Suppress recovery-entry traces, videos, screenshots, DOM dumps, verbose logs and raw exception output, and allowlist public status; verify injected sentinel secrets remain absent from stdout/stderr and all generated evidence on success and failure paths.
- [x] 2.4 Implement `status --live`, `inspect`, public UI `action`, and owned-session `run --scenario` dispatch with context revalidation, bounded reads and lifecycle cancellation; verify interactions outside the catalog work in the restored session without secret export, and document commands.
- [x] 2.5 Implement join/detach against an explicitly user-selected live page accessible through supported tooling or a supplied local debugging connection. Enforce public inspection and allowlisted navigation only; verify denied signing, secret access, settings/account/network changes, resets and automatic-submission routes, context invalidation and detach without logout/tab closure/storage changes. Test unavailable attachment and prevent ownership escalation when the joined identity matches a fixture. Document connection prerequisites and limits.
- [x] 2.6 Add game and BIS application adapters that restore fixture identities from the private vault through production UI while retaining separate storage/journals; verify Account integration via the public package and clarify the smoke runbook's phrase-copying language to prohibit application secret export while permitting authorized vault-based test restoration.

## 3. Standing permission and recovery accounting

- [x] 3.1 Bind the test grant to supplied and agent-created registered identities/generations across the ecosystem, supporting later revocation or limits; verify create/fund/onboard/test needs no renewed approval or budget/expiry configuration, while human joined sessions, unregistered identities and mainnet cannot inherit the grant.
- [x] 3.2 Add locked durable operation accounting with captured network, wallet, recipient, amounts and fees, and pending reconciliation across restarts; verify competing actions preserve input reservations, unknown outcomes retain recovery records and retries do not duplicate submissions.
- [x] 3.3 Implement named payment, sample mint/delivery, burn and contract claim/refund recovery scenarios through existing BIS UI guards; verify isolated lifecycle/idempotency cases and document intentional alteration of supplied test holdings under the standing grant.

## 4. Scenario preparation and wallet rotation

- [x] 4.1 Implement per-network readiness classification and on-demand test-account creation for empty and funded scenarios; verify previously used accounts are accepted, fresh identities inherit the standing test grant, funding is not inferred across networks and failed reads remain unavailable.
- [ ] 4.2 Implement preparation using existing funds first, optional separate faucet requests and BIS asset flows under standing permission, with retained operation/asset IDs; verify no redundant funding, acknowledgement stays pending, partial retry avoids duplicates and unrelated holdings remain untouched unless the scenario deliberately targets them.
- [ ] 4.6 Add BTC/Arkade funding from registered test wallets and supported faucet funding as separate workflows; verify exact destination/network/amount, new-account recipient evidence, retained operation IDs and honest handling of unavailable sources or interactive faucet prerequisites. Document the autonomous create → fund → onboard → use workflow.
- [ ] 4.3 Integrate the separately delivered onboarding route by driving private account creation/restoration, network selection and explicit 50% configuration before automatic eligibility submission; verify no funding is fabricated, both partial-settlement legs are reconciled, pending windows cannot be reset by network switching, and BIS rechecks readiness without database/journal copying. Document dependency on the user's network work and keep unavailable network scenarios explicitly incomplete.
- [x] 4.4 Implement zero-holdings/no-pending rotation with archived encrypted generations and preserved journals; verify funded, pending and unreadable wallets are refused, old identities remain recoverable and new agent-created test generations retain provenance and standing permission without touching human sessions.
- [x] 4.5 Document preparation, default 50% conversion versus separate funding, purposeful role assignments, account/network recovery, fresh-history rotation and safe rollback; add a root README link and verify commands and relative links without expanding package READMEs unnecessarily.

## 5. Integration acceptance

- [ ] 5.1 Run tooling tests, `npm run typecheck`, `npm test`, prototype faucet/onboarding tests and `npm run build`; verify production artifacts exclude fixture secrets, vault/profile files and fixture control endpoints, and record sanitized results under `output/reports/agent-test-wallets/`.
- [ ] 5.2 Verify autonomous create → fund → onboard → app-use on both networks with agent-created identities, plus supplied-account login/reload/logout/restore, assets, Player-to-Game payment and contract recovery across BIS applications and the game; verify the actual 50% settlement and public package provenance. Retain public evidence and report inaccessible accounts, unavailable sources and unperformed cases separately.
- [ ] 5.3 Verify joined-session public inspection and safe navigation against a live user-selected session, followed by detach and an owned scenario outside the fixed catalog; prove denied mutations initiate no new signing/submission, user state is not reset and no authority leaks between modes. Distinguish independent app background work from runner actions.

## 6. User-requested shared secret configuration

- [x] 6.1 Add `@bis/shared`, the canonical secret-free `.env.local.template`, Node-only consumer-key loader, Git/AI/triage exclusions, package README and rendered README route; backport all existing faucet server launch paths with explicit process-environment precedence and legacy fallback only when the shared file is absent, preserving existing private files.
- [x] 6.2 Add `test-wallets import --shared` for the four supplied account slots directly into the encrypted vault; verify empty slots, incompatible input, repeat registration and no secret output without reading actual populated files in tests.
- [x] 6.3 Verify workspace/lock registration, shared-loader and faucet tests, Vite secret-serving denial, documentation links, typecheck and build; retain public results and leave actual population to the user.

## 7. Concrete checkpoint follow-through

- [ ] 7.4 Recheck the complete-file checkpoint against parallel asset-cache and Sandbox dependencies before claiming an integrated passing baseline; verify exact committed-code typecheck/build and route tests, coordinate dependencies without silently absorbing unrelated files, and distinguish the prior passing scoped snapshot from the inclusive commit.
- [ ] 7.1 Diagnose the live Swap Review-control timeout with bounded public observations, retain the isolated availability-race regression, and verify a real Arkade-to-Bitcoin settlement before treating conversion as a BTC funding prerequisite; document exact intent/receipt and no-resubmission behavior.
- [ ] 7.2 Wire the existing private onboarding restoration seam into the public onboard-half scenario with original-input intent capture and both-leg settlement reconciliation; verify both networks against the separately delivered route without storage copying or pending-window reset.
- [ ] 7.3 Reconcile the existing unknown Signet faucet request before considering further funding; verify no resend on lost acknowledgement and document timestamped readiness separately for each supplied and agent-created account.
