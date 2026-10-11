# Agent test wallets

[Repository README](../../README.md) · [Completed foundation](../../openspec/changes/archive/2026-10-11-add-agent-test-wallet-workflow/milestone.md) · [Remaining implementation and acceptance](../../openspec/changes/complete-agent-test-wallet-acceptance/tasks.md)

## Scope and current status

The user authorizes supplied and agent-created disposable test identities throughout the BIS ecosystem on Signet and Mutinynet. No renewed spending approval, mandatory budget or expiry is needed for these registered identities. Existing application guards still apply. The grant does not include mainnet, personal browser profiles, unrelated projects or the faucet's signer credentials.

The implementation provides encrypted inventory, private import, account creation, role assignment, origin registration, owned Marketplace/Admin lifecycle and scoped collection interactions, readiness targets, existing-funds-first faucet preparation, read-only faucet reconciliation, durable Player-to-Game and registered-recipient Arkade payments, and limited joined Marketplace attachment. The game package handoff verifies version 0.0.21 independently; its live lifecycle acceptance remains separate. Onboarding, guarded asset/contract scenarios and conservative rotation are integrated with isolated coverage; live acceptance remains separate. An accepted command or account label is not evidence that those workflows have passed.

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

### Readiness targets

Live status can check an explicit target rather than guessing from an account label:

```powershell
npm run test-wallets -- status --account empty-player --network signet --live --expect empty
npm run test-wallets -- status --account funded-player --network mutinynet --live --expect funded --arkade 1000 --bitcoin 1000
```

Targets are observation requirements, not spending budgets or funding requests. `funded` defaults to one spendable Arkade sat; specifying only `--bitcoin` instead defaults to no Arkade requirement. Both thresholds may be specified, but at least one must be positive. `empty` accepts no thresholds. Creation remains separate and never funds the account automatically. Previously used supplied accounts are valid inventory; positive BTC/Arkade or asset holdings make an empty target `dirty`, without draining or altering it.

Readiness is network-specific: `empty` means verified zero balances/assets and no pending work in the checked application; `ready` means the spendable target is met with no pending work there; `dirty` means an empty target has holdings; `pending` retains unresolved runner, reported onboarding or application work; `incomplete` means a target or journal proof is missing, or spendable funds are insufficient; `unavailable` means a required read failed or was invalid. Reads are bounded and failed reads never become zero. Sender and registered recipient reservations both prevent readiness. Acknowledged funding is not settlement proof.

Standalone status does not attach to profiles or claim to inspect application journals: a zero balance or sufficient funds alone stays `incomplete`. Inside an already owned session, use:

```json
{"command":"status","live":true,"role":"player","expect":"empty"}
{"command":"status","live":true,"role":"game","expect":"funded","arkade":1000}
```

The role is bound to this registered pair and network; requests cannot override identity, origin or network. Context is checked before and after fresh observations. Only the production pending-operation count leaves the browser. Its conservative classifier includes all retained wallets/networks in the selected application's profile, so unrelated pending work there may block readiness rather than be discarded. The returned `journalScope` makes that limitation explicit: this is not verification of every independent application, and is insufficient alone to authorize global rotation. Joined sessions reject these commands. Unreadable journals stay unavailable; no profile/database/journal copying or cleanup occurs.

Register an exact loopback origin with `init --origin` before login. Changing the port requires explicit registration, not storage migration. Owned adapters currently support Marketplace and Admin:

After a verified game package upgrade and matching checked-in runner pin, repeat `init --origin` for the same game origin. It upgrades only the exact trusted BIS21 registration to pinned BIS22, retaining the path, muted query, profile, identities and operation journals. Current provenance is unchanged; unknown hashes, incompatible rows, duplicates and rollback refuse. This command accepts no caller-supplied version/hash override and does not clear pending work or reconcile the held Signet operation.

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

The BIS Send UI accepts Arkade addresses. Registered-wallet Bitcoin funding is available separately through the guarded source Arkade → distinct recipient Bitcoin Swap workflow documented below; direct Bitcoin UTXO spending is not implemented. Recipient funding and deliberate 50% onboarding remain separate operations with separate settlement evidence. Funding alone must not be reported as completed onboarding.

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

### Existing-funds-first preparation and read-only recovery

`prepare` observes a registered account on one explicit network; it does not create an identity, erase history or alter assets:

```powershell
npm run test-wallets -- prepare --account empty-player --network signet --expect empty
npm run test-wallets -- prepare --account funded-player --network mutinynet --expect funded --arkade 1000
```

An empty target with funds or assets stays dirty. Funded targets use existing spendable balances first; if funds already suffice, no faucet call occurs even when a source was supplied. Standalone preparation still lacks application journal proof and does not claim ready solely from a balance. Missing sources, read failures and known pending work are explicit results, not fabricated success. Its faucet option cannot supply Bitcoin; registered-wallet Bitcoin funding uses the explicit owned workflow below.

Faucet funding is opt-in with a separate exact amount and original operation ID:

```powershell
npm run test-wallets -- prepare --account funded-player --network signet --expect funded --arkade 1000 --source faucet --amount 50000 --operation example-prepare-1
npm run test-wallets -- reconcile --operation example-prepare-1
```

An existing submitted/pending/unknown operation is checked before making another funding decision. Repeating preparation cannot replace its source, account, network or amount; it invokes read-only reconciliation, never another funding POST. Exact fresh receipt evidence is separate from the new balance read. Unrelated assets are neither burned nor transferred. Sample-asset preparation is a separate explicit owned Admin scenario, rather than an automatic side effect of a balance target.

### Explicit asset and contract scenarios

An owned session accepts the following public requests; use a unique operation label for each intentional action, and the **same** label when reconciling it:

```json
{"command":"run","scenario":"mint-delivery","operation":"sample-asset-1","destination":"player"}
{"command":"run","scenario":"burn","operation":"sample-burn-1","assetId":"<68-hex-asset-id>","quantity":"1"}
{"command":"run","scenario":"contract-claim","operation":"claim-1","contractId":"<existing-contract-id>"}
{"command":"run","scenario":"contract-refund","operation":"refund-1","contractId":"<existing-contract-id>"}
```

Mint/delivery requires the Admin application and uses its normal sample mint form. It creates one `BISTEST` unit, directed to the selected Player or Game, and retains the original mint/delivery identifiers. Player delivery reserves both registered identities. Burn deliberately targets the supplied asset ID and exact currently owned quantity; it never chooses arbitrary holdings. Claim/refund targets an existing contract, matching its network, role and amount, and uses the production eligibility controls. A disabled control refuses the action; the runner does not manufacture a contract or bypass an expired offer.

These scenarios intentionally alter registered disposable test holdings, including supplied test accounts, under the standing grant. Preparation never burns or transfers unrelated holdings to achieve an empty label. Durable reservations commit before confirmation; lost acknowledgements retain unknown state, and repeated requests reconcile original product IDs without repeating signing. A mint acknowledgement alone does not prove Player delivery, and contract completion requires the production verified-receipt status. Unreadable or ambiguous evidence remains pending. Scenario tests use isolated synthetic wallets; live acceptance across applications and both networks remains separate.

`reconcile` is read-only and currently supports faucet operations. It uses the original saved source origin and request ID, not a caller-supplied substitute. If acknowledgement was lost, the existing faucet status endpoint can look up the original idempotency key with `?by=request`; this returns pending acknowledgement evidence only. A separate exact verified recipient receipt is still required for settlement. Revoked grants do not prevent recovery of submitted work. The runner never starts a faucet server, issues a POST or replays funding during reconciliation. The lookup currently uses the faucet process's request cache: a restart, older API or cache loss can leave the original outcome unknown. That retains the reservation; it is not permission to send again or manually clear the operation.

The supplied-account Signet onboarding warnings cannot be cleared by this faucet command. They require evidence for the original conversion and both settlement legs. Existing pending onboarding windows must not be switched or restarted.

### Conservative rotation and recovery

```powershell
npm run test-wallets -- rotate --account empty-player --network signet
```

Rotation checks fresh Bitcoin, Arkade and asset holdings on **both** networks, regardless of the creation network selected above. Any holding, unresolved operation, reported onboarding, unavailable read or active owned profile lock refuses replacement. The ordinary CLI proves application journals empty only for never-exposed agent-created identities: no retained pair assignment or historical operation may involve that account. Supplied, paired or previously used identities require an independently verified journal adapter; the CLI refuses them rather than treating missing evidence as zero. No human browser session is attached.

The old recovery identity, grant, generation and zero-holdings evidence remain encrypted in `archivedAccounts` inside the existing external vault. Replacement and archive commit atomically; an interrupted write leaves the old current generation recoverable. The new generation is agent-created and inherits the existing standing grant. Existing profiles, pairs and operation journals remain intact. Rotation neither drains funds nor erases history. There is no automatic restore-old-generation or force-clear command: preserve the vault and original browser profiles for explicit recovery, and never manually delete their locks to bypass an uncertain operation. Seven isolated tests cover refusal, generation continuity, encrypted archives and interrupted commit/restart; they do not claim live network acceptance.

The remaining workflow is create → fund → onboard → use. Prefer existing funds; funding must separately verify the exact recipient/network and retain operation IDs. `/onboarding/` converts existing BTC, normally 50%, and is not a funding source. Partial onboarding must verify both settlement legs, not just its intermediate Arkade balance. Preserve pending windows and reconcile before retrying. Do not drain supplied wallets to manufacture empty-state fixtures.

### Registered-wallet Bitcoin funding

Use fresh per-network recipient readiness first. If existing spendable Bitcoin already meets the scenario target, proceed without funding. When a distinct registered recipient needs Bitcoin, an owned BIS session whose Player has spendable Arkade funds accepts:

```json
{"command":"run","scenario":"funding-bitcoin","operation":"recipient-btc-1","recipientAccount":"new-player","amountSats":10000}
```

This withdraws **source Arkade funds to recipient Bitcoin** using normal Swap controls. It does not spend existing source Bitcoin UTXOs or convert back into the source's own Bitcoin balance. `recipientAccount` is an exact private-inventory label, not an arbitrary address; the runner derives and binds its registered identity/generation and selected network before review. Both identities require active standing grants. Self-funding, unregistered recipients, reported pending onboarding, unavailable policy and conflicting reservations refuse the action.

The product offers **Fund another Bitcoin account** within Arkade → Bitcoin Swap. Its public review shows the recipient address, network, amount, fee and net Bitcoin output. Source Bitcoin stays unchanged; source Arkade and total decrease. Changing the destination discards review. Confirmation rechecks the current account, fresh input/output fingerprint, fee policy, expiry, unreserved inputs and source asset-preserving change through the existing signing worker. Ordinary own-account Swap retains its default destination and estimates; existing version1 journals remain recoverable.

The encrypted runner intent reserves source and recipient generations before Confirm and binds the quote and original operation ID. Acknowledgement stays pending. Completion requires the exact confirmed recipient output, source inputs consumed by that commitment, exact source Arkade/asset change and a fresh independent recipient Bitcoin balance. Repeat the same request and operation label for read-only recovery; unknown acknowledgement never causes another confirmation or replacement funding. Preserve the original browser profile and journal while pending. Separate faucet requests remain their existing workflow; interactive external Bitcoin faucets are prerequisites, not implemented autonomous sources.

For create → fund → onboard → use: create/register the recipient, verify current readiness, fund only a missing target through the authorized source session, reconcile that same ID until recipient Bitcoin is usable, then assign the recipient to its intended role and run `onboard-half` separately. Keep original conversion inputs/window and verify both 50% settlement legs before normal app use. This code and synthetic coverage do not establish either network's live acceptance.

From an owned session, request conversion separately from funding:

```json
{"command":"run","scenario":"onboard-half","operation":"onboard-example-1"}
```

The runner captures eligible original Bitcoin outpoints/values before exposing the identity to the separately delivered production onboarding route. It retains the exact rounded-down 50% target, verifies the operator/network and supported fee policy, and rechecks the original inputs immediately before private restoration. Before recovery entry it checks the explicit network URL, displayed network, enabled 50% slider, hidden recovery surface, no existing account and no submitted transfer. Unexpected prompts are dismissed. The durable reservation commits before the native prompt is answered.

Each operation owns a separate restricted persistent profile and the production `window` identifier, bound to its origin, identity/generation and network. Repeated requests reuse that original window and reconcile; they do not repeat restoration, switch networks, reset its state or copy databases. Closing preserves the profile and journals; failed browser cleanup preserves its ownership lock. Keep the existing window/profile while either settlement leg remains unresolved.

Completion requires the original-input Bitcoin-to-Arkade commitment and Bitcoin remainder-return transaction, exact 50% amounts, confirmed independent provider receipts and a fresh independent BIS balance read. An intermediate whole-input Arkade receipt is insufficient. Unavailable funding, fee policies, operators, windows or receipts stay unavailable/pending. Fifteen isolated runner/browser tests and four existing foundation tests pass for both network configurations; real Signet and Mutinynet settlement acceptance remains unperformed until separately evidenced. This depends on the user's delivered onboarding network behavior and is not a faucet or BTC funding source.

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

After building the normal applications and `npm run build --workspace @spike/prototype-onboarding`, run `node BIS/scripts/verify-test-wallet-build.mjs`. It requires all five build directories and rejects known fixture secret-slot names, runner/control code and private environment/vault/profile files without reading actual secrets. This is a structural exclusion check, not a guarantee that arbitrary secrets cannot appear in a bundle. Its isolated regression uses synthetic bytes only. A passing build scan does not prove wallet settlement or game acceptance.
