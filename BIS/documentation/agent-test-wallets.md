# Agent test wallets

[Repository README](../../README.md) · [Completed foundation](../../openspec/changes/archive/2026-10-11-add-agent-test-wallet-workflow/milestone.md) · [Remaining implementation and acceptance](../../openspec/changes/complete-agent-test-wallet-acceptance/tasks.md)

## Scope and current status

The user authorizes supplied and agent-created disposable test identities throughout the BIS ecosystem on Signet and Mutinynet. No renewed spending approval, mandatory budget or expiry is needed for these registered identities. Existing application guards still apply. The grant does not include mainnet, personal browser profiles, unrelated projects or the faucet's signer credentials.

The current implementation provides encrypted inventory, private import, account creation, role assignment, origin registration, owned Marketplace/Admin login/navigation/reload/logout/restore, durable Player-to-Game and registered-recipient Arkade payments, separate Arkade faucet requests and limited joined Marketplace attachment. BTC preparation, onboarding, arbitrary UI actions, other named financial scenarios, game adapters and rotation remain implementation work. An accepted command or account label is not evidence that those workflows have passed.

## Private storage

On Windows, `init` creates a repository-specific folder beneath `%LOCALAPPDATA%/BIS/agent-test-wallets/`. Recovery material is protected with current-user DPAPI; directory access is limited to that Windows user and SYSTEM. This location must remain outside the repositories and Vite-served roots. Junctions and symlinks are rejected. The vault is a single atomically replaced envelope containing encrypted records and an identity-bound public manifest, so interrupted registration cannot commit mismatched files. A lock prevents concurrent writes. Protection/ACL failures stop the command; there is no plaintext fallback.

Browser profiles live beneath the same restricted directory and are dedicated to a network/pair/origin/application. Never copy profiles, IndexedDB, localStorage or operation journals between applications or ports. Admin and Marketplace naturally share persistence when visited in one ordinary browser profile; the runner deliberately separates their profiles and restores each independently from the private vault through normal UI. Existing Marketplace profile paths remain unchanged.

This is test tooling, not production custody. Same-user malicious code is outside its protection boundary. Recovery strings necessarily exist temporarily in runner memory. They must never be printed, passed in shell arguments, stored in reports, or captured by Playwright tracing, video, screenshots or DOM dumps.

## Inventory commands

Run from the repository root:

```powershell
npm run test-wallets -- --help
npm run test-wallets -- init --origin http://127.0.0.1:5174
npm run test-wallets -- create --account empty-player --network signet
npm run test-wallets -- create --account empty-game --network mutinynet
npm run test-wallets -- status
npm run test-wallets -- assign --pair example-signet --player empty-player --game empty-game --network signet
```

`create` uses BIS's existing account generation/operator validation flow and saves the identity encrypted. It does not send money, supply BTC, or prove empty/funded readiness. Both networks are available to the identity; balances and history must be observed separately on each. Missing network observations are reported as unavailable, never zero.

Use `status --account <label> --network signet --live` for read-only current balances and asset count. Omit `--network` to observe both networks independently. Failed reads remain unavailable without fabricated zero values. Unresolved runner operations report pending. Even zero holdings do not establish an empty scenario until application journals are verified; current live status explicitly reports that remaining check. Ordinary `status` does not reuse an old observation as current readiness.

For supplied accounts, populate the four slots in [Shared’s template](../packages/shared/.env.local.template), copied to `BIS/packages/shared/.env.local`. The user explicitly chose this canonical developer-secret input on 2026-10-11. It is excluded from Git, AI and triage and blocked from Vite serving; those protections do not encrypt the input file. Keep it private using operating-system permissions. The runner loads only test-account slots, never the faucet signers, then encrypts imported runtime identities in its external vault.

The four supplied accounts were privately imported on 2026-10-11 as `test-account-1` through `test-account-4`, generation 1. The user reported pending Signet onboarding for all four. This history is retained as an encrypted, network-scoped unresolved-operation warning, not as balance or settlement evidence. It blocks new runner submissions on Signet and survives repeated import, while read-only observations and reconciliation of previously submitted runner operations remain possible. Mutinynet is observed independently. Do not clear that warning based solely on a positive Arkade balance; reconciliation must establish the original transfer and both settlement legs. Keep existing onboarding windows/journals rather than starting replacements. Current tooling has no manual force-clear command for this warning.

```powershell
npm run test-wallets -- import --shared
```

An explicitly supplied private external JSON input remains an alternative. It is an array of objects containing a neutral `label` and a compatible 12-word `phrase`. Do not paste it into chat or print it. The reader requires a regular, single-link file owned by the current Windows user with no broadly granted read access. It reads only that named input, never searches for wallets, and does not move the JSON source into a repository/output directory.

```powershell
npm run test-wallets -- import --input C:\private\bis-supplied-accounts.json
```

This example is a user-provided source location, not an instruction to create a plaintext temporary export. Import retains each completed identity across interruption, accepts repeated registration of the same label/identity, and rejects identity replacement and duplicate signers. It does not delete or modify the source. Do not erase the user's original backup. Player and Game must be distinct registered identities; changing an established pair requires reconciliation rather than silent reassignment.

## Owned browser transport

Register an exact loopback origin with `init --origin` before login. Changing the port requires explicit registration, not storage migration. Owned adapters currently support Marketplace and Admin:

```powershell
node BIS/scripts/test-wallets/cli.mjs open --pair example-signet --origin http://127.0.0.1:5174 --app marketplace
node BIS/scripts/test-wallets/cli.mjs open --pair example-signet --origin http://127.0.0.1:5174 --app admin
```

The process owns a headless persistent context and stays running. It restores Player then Game through hidden production recovery inputs and verifies public network/address evidence. The agent's terminal-session handle is the transport; no HTTP browser-control or signing endpoint is created. Send newline-delimited public requests to that process's stdin:

```json
{"command":"inspect"}
{"command":"action","type":"navigate","screen":"Accounts Details"}
{"command":"run","scenario":"reload"}
{"command":"run","scenario":"logout"}
{"command":"run","scenario":"restore"}
{"command":"run","scenario":"payment","operation":"example-player-game-1","amountSats":1000}
{"command":"run","scenario":"funding","operation":"example-new-account-funding-1","amountSats":20000,"recipientAccount":"empty-player"}
{"command":"run","scenario":"swap-to-bitcoin","operation":"example-bitcoin-preparation-1","amountSats":10000}
{"command":"close"}
```

Closing stops only this owned browser and preserves its profile/vault. No automatic logout, reset, funding or replenishment occurs. Unsupported commands return an explicit unavailable reason instead of simulated success. Never attach another browser to a locked profile. After a process crash, preserve the profile and lock for recovery; do not delete a lock merely because an observation timed out.

Explicit logout checks reported external onboarding, unresolved runner operations, and the production cleanup classifier before acknowledging the normal product UI. Because Player logout also clears retained Game Wallet state, the read-only classifier view includes Game-owned journals and conservatively checks all profiles/networks in that browser. No ownership marker is modified. Unreadable journals or an unavailable development module refuse logout; the classifier currently requires the Vite source-serving route and is not a packaged-production adapter. The encrypted fixture vault supplies the backup acknowledgement without revealing the app's recovery phrase. A successful logout stays logged out across reload and denies other actions until explicit `restore`; restore verifies Player then Game again. An uncertain logout or partial restore closes this runner session while preserving its profile for explicit recovery. Isolated browser checks cover valid empty, retained Game-owned and malformed v2 reservation containers on both networks. Live agent-created Mutinynet logout, logged-out reload, denied Send navigation and explicit restoration of both original identities passed on 2026-10-11 after correcting the cleanup classifier's v2 container handling. This does not establish supplied-account, Signet or cross-app lifecycle acceptance.

Navigation currently supports Account, Accounts Details, Developer, Game Wallet, Send, Receive, Assets and Transactions. These named public surfaces are an initial adapter, not yet arbitrary application control. Recovery-reveal navigation is rejected. Every action checks the exact origin, application path, registered application, network, both registered generations/grants, the public Player ID and Game address. Shared BIS views render only public identity markers for this check, including collection views; no signing or fixture endpoint is added. Admin opens its normal A.P.4 Account Dialog control. The browser receives only allowlisted OS environment settings, not mnemonic, cloud credential or debug environment variables. Live agent-created Mutinynet Admin restore/reload/public navigation/logout/logged-out reload/explicit restore passed on 2026-10-11; concurrent Marketplace stayed connected while Admin remained logged out, demonstrating separate owned storage. This is not Signet, supplied-account, mint or contract acceptance.

Owned sessions also accept collection interactions independently of named scenarios:

```json
{"command":"action","type":"refresh","screen":"Assets"}
{"command":"action","type":"select-item","screen":"Assets","index":0}
```

Navigate to Assets or Transactions first. `select-item` selects a zero-based visible collection entry (0–999); `refresh` activates that collection's normal Refresh control. Both return only the usual allowlisted session inspection, never item text, raw data previews or DOM dumps. Identity/network/origin/screen are checked again in the browser turn that activates the control. Busy collections, mismatched contexts and unavailable controls are refused. A browser failure closes only the owned context and preserves its profile/journals, with no automatic retry. Burn, payment, recovery, arbitrary selectors and script evaluation are not collection actions. Joined mode rejects both commands. This is isolated coverage, not live acceptance or unrestricted UI control; task 2.4 remains open for complete dispatch, bounded reads and lifecycle coverage.

The payment scenario sends from the selected Player to the selected Game through the existing Send UI. It enters the amount/address, reads Review Send, durably captures fee/network/recipient/amount and prior public transaction IDs, revalidates the same visible review, and activates Confirm Send. It does not bypass the product's quote, reservation or signing guards. The reader projects only validated public fields from that identity/network's Send journal; it neither exports wallet databases nor copies journals between apps. Exact recipient spendable receipt evidence is required for `payment-verified`.

Repeat the identical operation ID and amount to reconcile or return the settled result without confirming another send. Changed intent is rejected. A lost acknowledgement can be matched only to one new exact public Send record outside the saved prior IDs; ambiguous or unavailable evidence stays unresolved. A prepared operation without its original visible review is not silently confirmed after restart. Run commands sequentially if a simultaneous read reports `vault-locked`; do not delete the lock or create a replacement financial intent.

The owned `funding` scenario uses the selected Player's normal Arkade Send UI to fund another registered test account, rather than always sending to the paired Game. It derives the target's address on the selected network, captures its public identity/generation with the reviewed intent, and rechecks registration/permission before submission. Both sender and target remain reserved while unresolved; another network remains independent. Self-funding, unregistered targets and arbitrary secret/address fields are rejected by this provisioning scenario. Changed recipient, generation or amount cannot reuse the operation ID. Exact fresh recipient spendable receipt evidence is required for `funding-verified`; a successful review or acknowledgement is insufficient. Revocation blocks new submission but the durable ledger still permits read-only reconciliation of submitted work.

Live Mutinynet acceptance on 2026-10-11 created `agent-onboard-1`, verified zero holdings, and funded it with 20,000 Arkade sats from `agent-player-1` at a zero-sat Send fee. Repeating the intent returned the same settled operation; changing it to 20,001 sats was rejected. An independent live read found 20,000 available Arkade sats, zero BTC and zero assets. The separate `agent-onboarding-mutinynet` pair prepares that account as Player with `agent-game-1` as Game; no swap or onboarding has run yet. The supplied accounts were untouched.

The existing BIS Send UI accepts Arkade addresses only. Direct BTC-to-another-account sending is not implemented by this runner or that UI. An existing-product alternative is Arkade funding followed by the recipient's own normal Arkade → Bitcoin swap, then its deliberate 50% onboarding flow; that multi-leg orchestration and settlement verification remain implementation/acceptance work. Funding alone must not be reported as completed BTC preparation or onboarding.

Swap preparation exposed production prerequisites repaired on 2026-10-11: insufficient funds in the default Bitcoin direction no longer disable choosing the reverse direction, and transfer registration/progress/recovery/acknowledgement/discard reads and record locks use the selected network. Independent availability-read generations also prevent amount edits from discarding a pending availability result. Busy/review controls and transfer availability, amount, quote and settlement safeguards remain effective. Synthetic rendered UI checks and both-network SDK postcommit recovery checks passed, including absent/wrong/unconfirmed receipt evidence. The runner described below now exists, but these isolated checks do not establish live BTC/onboarding acceptance; no swap has been submitted for `agent-onboard-1`.

### Owned Arkade → Bitcoin preparation

The owned runner now supports Swap navigation and the `swap-to-bitcoin` request above. The gross amount includes the reviewed fee; Bitcoin goes only to this Player's own production-derived boarding address. Before Confirm, the encrypted ledger captures amount, fee, net output, destination, network, generation, quote fingerprint/expiry and prior public transfer IDs. Confirmation rechecks that exact visible review. A prepared operation requires its original review; an expired quote cannot silently be replaced under the same intent.

After submission starts, repeating the identical operation only reconciles; unknown outcomes never trigger another Confirm. Matching requires the original identity/network, destination, amounts and fingerprint, excluding prior records. Settlement requires fresh online evidence: exact confirmed Bitcoin output, original consumed inputs attributed to the commitment, and exact Arkade/asset change through the production verifier. A balance change or journal success label alone is insufficient. Pending source/recipient scope remains reserved. Joined mode denies Swap.

Public Swap inspection exposes only fixed direction/availability categories and control-enabled flags, never arbitrary DOM text or storage. Both-network isolated submission/retry/receipt checks and rendered reader/redaction checks pass. Live Mutinynet attempts for `agent-onboard-1` reached the Bitcoin direction but Review remained disabled; the UI reported `insufficient-funds` (no eligible unreserved inputs). No intent was prepared or submitted. An independent read at 2026-10-11T14:07:22Z still showed 20,000 available Arkade sats, zero Bitcoin and no assets. The balance/eligibility discrepancy is unresolved, not permission to bypass selection guards. BTC preparation and half-onboarding remain unverified; the supplied accounts were not altered.

## Separate Arkade faucet funding

An explicit request funds one registered account on one selected network:

```powershell
npm run test-wallets -- fund --account empty-player --network signet --source faucet --amount 50000 --operation example-funding-1
```

Use a unique operation label for a new intent. Repeat the identical command to inspect/reconcile that intent, not to submit another payment. Amounts are the existing faucet choices: 50000, 100000 or 200000 sats. The runner derives and verifies the recipient through the production account/network adapter rather than accepting an arbitrary recipient. It uses the configured local faucet port; `--api http://127.0.0.1:5190` explicitly selects a loopback endpoint. This does not repurpose faucet signer identities as test accounts.

Before requesting funds, the encrypted vault durably records the account identity/generation, network, recipient, amount, source origin and stable request ID. A wallet/network reservation spans runner applications. A committed submitting marker precedes any request; an exception or lost response leaves an unknown reservation. Repeating an unknown or pending operation never sends again, even if the faucet restarted and forgot its in-memory idempotency cache. Acknowledgement alone remains pending. Verified funding requires the exact acknowledged transaction in fresh recipient history with matching spendable outputs and amount. A balance increase alone is not proof. Read failures do not become zero balances or successful delivery. If acknowledgement was lost before its transaction ID was retained, reconciliation remains unavailable until the originating operation can be identified; do not create a replacement intent to bypass that reservation.

These checks are local orchestration, not a replacement for product input reservations, network validation or fee policies. Fee intent may be unknown before execution; verified observations can retain actual fees. Operation records survive restarts. No CLI recovery override or lock deletion is provided. The current isolated tests do not establish live faucet delivery on either network.

## Intended full workflow and verification

The remaining workflow is create → fund → onboard → use. Prefer existing funds; funding must separately verify the exact recipient/network and retain operation IDs. `/onboarding/` converts existing BTC, normally 50%, and is not a funding source. Partial onboarding must verify both settlement legs, not just its intermediate Arkade balance. Preserve pending windows and reconcile before retrying. Do not drain supplied wallets to manufacture empty-state fixtures.

The onboarding adapter currently has an internal, fresh-window-only private restoration seam, not an available CLI scenario. Its durable intent captures original Bitcoin outpoints/values and the exact rounded-down 50% target. Before recovery entry it checks the explicit network URL, displayed network, enabled 50% slider, hidden recovery surface, no existing account and no submitted transfer. Unexpected prompts are dismissed; network switching and restarting existing accounts are not supported by this seam. The ledger commits before the native prompt is answered. Registration remains pending; an unidentified result remains unknown and cannot cause a repeat restoration. Native dialogs are exercised on isolated synthetic pages for both network URLs, not treated as live operator evidence. Production input eligibility, persistent window recovery, both settlement legs and independent BIS receipt verification still need integration and live acceptance before `onboard-half` is exposed.

## Join an existing Marketplace session

The initial joined adapter supports an explicitly selected Marketplace tab already exposed through a user-supplied loopback Chromium debugging connection. It does not start/restart a personal browser, find debugging ports, copy profiles, unlock accounts or navigate a new tab to pretend it joined an existing session. If that connection is unavailable, use an owned test session or supply the missing connection deliberately; the runner reports sanitized attachment unavailability.

Select the exact Chromium target ID from that connection's page listing, not a profile path, URL alone or an unrelated browser tool's numeric tab index. The selected tab must already show a connected account on Account, Accounts Details, Receive, Assets or Transactions, at the exact `/marketplace/` destination with no query/fragment. This initial adapter does not support Admin, the game or standalone onboarding in joined mode. The debugging connection grants broad browser access, so keep it private and loopback-only; the runner's policy is not a security boundary against other same-user code with access to it.

```powershell
node BIS/scripts/test-wallets/cli.mjs join --origin http://127.0.0.1:5174 --app marketplace --api http://127.0.0.1:9222 --page <explicit-32-hex-target-id>
```

The running process accepts only these public requests:

```json
{"command":"inspect"}
{"command":"action","type":"navigate","screen":"Accounts Details"}
{"command":"action","type":"navigate","screen":"Assets"}
{"command":"detach"}
```

Allowed destinations are Account, Accounts Details, Receive, Assets and Transactions. Inspection returns validated public identity/network, current screen and numeric balances already displayed, with `freshness: displayed-ui-only`; it does not prove a fresh network read or funded readiness. It does not read secret inputs, arbitrary DOM text, database contents or browser storage. Public navigation revalidates origin, identity, network and screen in the same browser turn as activation. Identity, origin or unsafe-view changes invalidate the attachment; switching back does not restore its authority. Detach and explicitly join again when an appropriate context is selected.

Creation/import, network/account changes, recovery access, settings, Send, Swap, Contracts, Developer, Game Wallet, onboarding, reload, signing, submission and arbitrary selectors/evaluation are denied. No vault or fixture-grant lookup is performed: a matching registered test identity still remains joined-only. The installed CDP connection uses `noDefaults` to avoid changing downloads/focus/media settings. `detach` disconnects this transport without logout, closing the tab/browser or clearing storage; it ends the CLI session. `close` is not a joined command. Existing application background work can continue independently; the runner does not freeze it. Isolated real-Chromium/CDP and CLI tests verify these behaviors with synthetic non-wallet data. Acceptance against an actual user-selected human session remains unperformed.

Run `node --test BIS/scripts/test-wallets.test.mjs` for focused tests. Windows ACL/DPAPI tests need normal host access; a sandbox denial is not a reason to weaken the ACL. Test evidence is isolated unless specifically identified as live. Store sanitized reports under `output/reports/agent-test-wallets/`, never wallet material. Full completion also requires the application's typecheck/tests/build and live two-network funding, onboarding, app and game acceptance listed in the plan.
