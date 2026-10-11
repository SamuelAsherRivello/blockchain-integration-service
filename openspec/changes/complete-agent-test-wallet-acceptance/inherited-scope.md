# Original unsplit scope (historical)

Preserved at the user's 2026-10-11 checkpoint. These texts document scope provenance, not current completion claims. Current proposal/design/spec/tasks supersede them; existing checked tasks are reused foundation only.

## Original proposal.md

# Proposal

## Why

The agent needs to create, fund, onboard, and use test accounts independently throughout the BIS ecosystem, including the game. A separate workflow must let it join a user-selected existing session with explicit limits, while supplied and agent-created test accounts support autonomous testing.

## What Changes

- Import and retain the four supplied funded test accounts and create additional test accounts as needed, including accounts to fund and onboard. Assign Player/Game roles purposefully per scenario across BIS applications and the Stealth & Steel game.
- Add local developer commands to initialize private storage, import supplied accounts, inspect, open, prepare, run scenarios, and rotate disposable test wallets, with public status output and private secret handling.
- Keep recovery material in an encrypted Windows-user-scoped vault outside the repository and Vite roots. Use isolated browser profiles, selected by network and pair, and the existing production restore UI.
- Preserve funded profiles and their local recovery journals across runs. Verify empty states before using them; create fresh identities when pristine history is required.
- Record standing permission for supplied and agent-created test accounts throughout the BIS ecosystem on Signet and Mutinynet, including funding, spending, transfers, onboarding, minting, burning, and contracts. Do not require renewed permission or mandatory spending budgets/expiry. Bind permission to verified registered test identities; preserve existing product guards.
- Add an explicitly selected join-existing-session mode for public inspection and navigation only, with public identity verification and detach that preserves the user's session. Changes, signing, logout, reset, secret access and automatic-submission routes use owned test sessions instead. This boundary is chosen under the user's explicit delegation to the agent.
- Reuse `/onboarding/` for account creation/restoration and conversion of existing BTC to Arkade, explicitly selecting the default 50% when that scenario is requested. It does not supply funding. Depend on the user's separate network-dropdown work and verify behavior before claiming both networks are supported.
- Use existing funded balances first; reuse the separate prototype faucet only when a test needs additional Arkade funding. Report verified, pending, unavailable, and incomplete preparation distinctly.
- Document the agent workflow and add meaningful isolation, redaction, policy, lifecycle, and browser verification.
- Add `@bis/shared` with the canonical `.env.local.template` for all developer-supplied faucet/test-account secrets; privately consume populated `.env.local`, exclude it from Git/AI/triage and browser serving, and backport existing faucet launch paths to the central loader. This explicitly requested input source does not replace encrypted runtime vault storage.

## Capabilities

### New Capabilities

- `agent-test-wallets`: Local provisioning, private browser restoration, scenario preparation, scoped authorization, and lifecycle management of disposable agent-operated wallets.

### Modified Capabilities

None. The tool drives existing restore, logout, network, financial, and role-conflict behavior; it adds no production account bypass or game API. Each application owns its browser persistence; explicit test-account restoration uses the private fixture vault rather than copying another application's storage.

## Impact

- New developer tooling and tests under `BIS/scripts/`, with npm entry points and a dedicated workflow guide under `BIS/documentation/`.
- Uses existing Node, Playwright, BIP39/Arkade dependencies, Windows secret protection, the onboarding route, and the prototype faucet helper; introduces no hosted signing service.
- Existing account secrets use encrypted IndexedDB, while network preferences and operation journals also use browser storage. A browser profile, rather than a localStorage dump, owns each test session.
- Include adapters and acceptance for Admin, Marketplace, Onboarding, Faucet as a funding tool, and the Stealth & Steel game. Record exact application origins and package provenance; do not copy browser databases or recovery journals between applications. The same registered test identity can be restored independently through each application's normal private flow.
- `openspec/config.yaml` still says Signet only; the current project brief, network specification, implementation, and this user's request establish both Signet and Mutinynet. This proposal uses that current scope without rewriting unrelated planning context.
- Standing test authorization was explicitly supplied by the user on 2026-10-11. The accounts' prior history is accepted; their identities, private access location, role assignments, and current network balances remain runtime registration facts, not assumed values. Funding on one network does not establish funding on the other.
- Planning creates no wallets and submits no transactions. The onboarding dropdown and network implementation are owned by separate work (`redesign-developer-onboarding-faucet`); this change consumes that route rather than implementing its network support.
- The expanded goal includes autonomous agent-created funded accounts and limited access to a user-selected existing session. Grill Me Question 1 is resolved by the user's express delegation to choose joined-session limits: public inspection and navigation. Planning readiness is distinct from live acceptance, which remains unproven until implementation and end-to-end verification.


## Original specs/agent-test-wallets/spec.md

# Spec Delta

## Purpose

Provide reusable disposable test wallets for agent-operated BIS browser checks, with private login, explicit financial scope, and truthful scenario readiness across Signet and Mutinynet.

## ADDED Requirements

### Requirement: Central developer-secret configuration
`@bis/shared` SHALL provide a secret-free `.env.local.template` and Node-only loader for the canonical shared `.env.local`. Populated files SHALL be excluded from Git, AI and triage and denied through Vite paths including raw imports. Consumers SHALL receive only selected keys: faucet signer/configuration keys or supplied test-account slots. Existing faucet launch paths SHALL use the same loader without deleting existing credentials.

#### Scenario: Canonical source supersedes legacy configuration
- **WHEN** the shared `.env.local` exists
- **THEN** server-only consumers read their allowlisted keys, with explicit process environment values taking precedence
- **AND** blank or missing shared entries are not silently filled from the old faucet file

#### Scenario: Transitional configuration
- **WHEN** the shared `.env.local` is absent
- **THEN** faucet consumers may use the existing package-local file without exposing its contents
- **AND** the test-account importer does not read faucet signer keys as fixtures

#### Scenario: Supplied account slots
- **WHEN** the runner explicitly imports the populated shared test-account slots
- **THEN** compatible unique identities are registered in the encrypted runtime vault with standing test permission
- **AND** no recovery material is returned publicly or exported from generated identities into the source file

### Requirement: Named disposable wallet inventory
The developer tool SHALL privately register the four supplied test accounts and additional agent-created accounts, preserve existing identities and journals, and expose only public metadata. Player/Game assignments SHALL use distinct identities. New accounts SHALL support empty or funded scenarios. Mainnet and personal browser profiles SHALL be rejected as owned test fixtures.

#### Scenario: Initialize and repeat
- **WHEN** the four supplied accounts are privately imported and registration is repeated
- **THEN** each resolves to its verified public identity without replacement or duplicate registration
- **AND** registration submits no financial operation

#### Scenario: Partial initialization recovery
- **WHEN** registration resumes after only some supplied accounts were durably saved
- **THEN** only missing registrations are completed and saved identities, generations and journals remain unchanged

#### Scenario: Empty account needed
- **WHEN** a selected test requires zero holdings or pristine history
- **THEN** an additional disposable identity is created through an existing account flow
- **AND** supplied funded identities are not drained or replaced to meet the empty condition

#### Scenario: Flexible role assignment
- **WHEN** two registered accounts are selected as Player and Game on a supported network
- **THEN** their role assignments are verified and their balances and history are observed for that network independently
- **AND** equal identities or unresolved conflicting work block role reassignment

#### Scenario: Unsupported network
- **WHEN** a command selects mainnet or an unknown network
- **THEN** it fails before secret access, browser restoration, or financial submission

### Requirement: Private local recovery storage
Imported and generated runtime recovery material SHALL be encrypted for the local operating-system user outside repository and served directories. The explicitly user-selected shared `.env.local` MAY supply developer secrets as private plaintext input, subject to source exclusions and serving denial. Recovery material SHALL NOT enter chat-facing output, source control, URLs, command arguments, plaintext temporary exports, reports, browser captures, or published assets. Unavailable runtime protection or invalid vault identity binding SHALL block access without a plaintext fallback.

#### Scenario: Protector unavailable
- **WHEN** the vault cannot be protected or decrypted for the current user
- **THEN** the command reports a sanitized unavailable category without creating plaintext recovery files or changing browser selection

#### Scenario: Restore fails with sensitive context
- **WHEN** an automation or provider failure contains recovery input or signing material
- **THEN** output contains only allowlisted public identifiers and safe reason codes
- **AND** traces, screenshots, video, and DOM dumps do not capture recovery entry

#### Scenario: Manifest mismatch
- **WHEN** a public fixture manifest points to a different encrypted identity or generation
- **THEN** the command rejects that fixture before restoration or signing

### Requirement: Explicit restoration in an owned browser session
An explicit open command SHALL restore the selected network and pair through existing production restore flows in a dedicated owned browser profile. It SHALL preserve role-conflict, network, logout, and pending-operation guards. Merely opening a product URL SHALL NOT auto-import fixtures. Subsequent agent actions SHALL use that owned session without exposing recovery input.

#### Scenario: Open either network pair
- **WHEN** the agent explicitly opens a registered pair on an authorized BIS origin
- **THEN** Player restoration precedes Game restoration and public observations confirm the expected distinct identities and network
- **AND** the runner supports subsequent public inspection and permitted scenarios in the same session

#### Scenario: Reload or explicit logout
- **WHEN** the owned browser reloads or an account is explicitly logged out
- **THEN** the existing product persistence and cleanup behavior applies
- **AND** the tool does not silently recreate an identity after logout

#### Scenario: Concurrent ownership
- **WHEN** a second process attempts to use a profile already owned by a runner
- **THEN** the second process fails safely without sharing browser state or running actions concurrently

### Requirement: Owned sessions support independent application interaction
Owned test sessions SHALL support public inspection and UI actions beyond predefined scenarios. Each action SHALL revalidate session mode, origin, identity and network. Private recovery input SHALL remain inside the runner. Financial actions SHALL retain existing product guards and durable operation identity. Arbitrary owned interaction SHALL NOT provide an escape from joined-session restrictions.

#### Scenario: Test outside the scenario catalog
- **WHEN** the agent needs a UI interaction not represented by a named scenario in an owned test session
- **THEN** it can inspect public UI and execute the interaction under standing permission with verified context
- **AND** it does not need to alter the runner's scenario catalog merely to use the app

### Requirement: Application origins and persistence remain distinct
The runner SHALL support registered BIS applications and the game with verified exact origins and application-specific login. It SHALL restore registered test identities privately from the vault without copying browser databases or journals between applications. Personal profiles SHALL NOT become owned test profiles. A new port or hostname SHALL require fresh origin selection and restoration.

#### Scenario: Changed preview port
- **WHEN** the preview runs on a new port absent from the authorized origin configuration
- **THEN** opening the pair is rejected until that exact origin is explicitly configured
- **AND** no storage is migrated from the previous origin

#### Scenario: Registered game destination
- **WHEN** a test uses the registered Stealth & Steel game origin
- **THEN** the runner restores the selected test identity through the game's production Account flow and verifies package provenance
- **AND** it preserves independent game-origin storage and uses muted automated game URLs

#### Scenario: Unrelated destination
- **WHEN** a command targets an unrelated project or attempts to use a personal profile as an owned test fixture
- **THEN** the command rejects the target without importing secrets or browser state

### Requirement: Standing test authorization
The runner SHALL honor standing permission for supplied and agent-created test accounts across registered BIS applications and the game on Signet and Mutinynet. Creation, funding, onboarding and test operations SHALL NOT require renewed spending approval, mandatory budgets or expiry configuration. Permission SHALL remain bound to registered test identities and honor later revocation or limits. Existing product guards SHALL remain effective.

#### Scenario: Supplied account test operation
- **WHEN** the agent selects a supplied account for a payment, transfer, onboarding, mint, burn, or contract test
- **THEN** the standing grant permits execution without another spending approval
- **AND** existing network, input, confirmation and recovery safeguards still apply

#### Scenario: Agent-created funded account
- **WHEN** the agent creates and registers a test account for a funded scenario
- **THEN** it can fund, onboard and test that account under the same standing permission as the supplied accounts

#### Scenario: Human session outside test grant
- **WHEN** the agent joins an existing human session
- **THEN** owned test-account permissions do not transfer to that session

#### Scenario: Revocation or identity change
- **WHEN** permission is revoked or prepared work no longer matches its captured identity and generation
- **THEN** new submissions are blocked and existing pending work remains available for reconciliation

### Requirement: Durable spending and retry accounting
The runner SHALL coordinate conflicting submissions and durably record operation identities, amounts, recipients, fees and originating wallet/network scope. Pending or unknown results SHALL retain recovery records. Retries SHALL reconcile the original operation before a new submission. Existing input reservations and fee-policy checks SHALL remain effective without a mandatory budget engine.

#### Scenario: Competing operations
- **WHEN** concurrent test actions compete for the same wallet inputs
- **THEN** coordination preserves the existing input reservations and prevents conflicting submission

#### Scenario: Lost response
- **WHEN** a financial submission response is lost or a runner restarts with a pending operation
- **THEN** reconciliation uses the saved operation identity and original wallet/network scope
- **AND** no replacement payment, funding request, mint, or contract is submitted merely because the result is unknown

### Requirement: Observable scenario readiness
Status SHALL distinguish verified empty, ready, dirty, pending, incomplete, and unavailable states using timestamped public observations. Empty readiness SHALL require zero balances, no holdings, and no unresolved operations. Populated readiness SHALL require the requested spendable funds and asset targets. A fixture label or failed read SHALL NOT establish readiness.

#### Scenario: Empty pair has received data
- **WHEN** a wallet labeled empty has funds, assets, or unresolved operations
- **THEN** the tool reports dirty or pending and does not erase records or drain funds to claim emptiness

#### Scenario: Unavailable balance read
- **WHEN** a provider cannot supply a valid current balance or inventory
- **THEN** readiness is unavailable and neither zero nor populated success is reported

### Requirement: Explicit idempotent preparation
Preparation SHALL inspect existing per-network funds first and describe required changes. Execution SHALL use standing permission and existing onboarding, faucet or BIS flows for supplied and agent-created test accounts. Operation and asset IDs SHALL prevent duplicate preparation. Read-only inspection SHALL NOT start onboarding or replenishment; deliberate holding changes SHALL record their test intent.

#### Scenario: Fund a new account
- **WHEN** the agent creates a test account whose scenario requires BTC or Arkade funds
- **THEN** it selects an appropriate funding source, verifies destination and network, submits through the supported flow and verifies recipient evidence
- **AND** funding acknowledgement alone does not establish usable funds

#### Scenario: Funding requires a human step
- **WHEN** no configured funding source can complete or an external faucet requires interactive authentication or CAPTCHA
- **THEN** the runner reports the precise unmet prerequisite without claiming autonomous funding succeeded

#### Scenario: Existing usable funds
- **WHEN** current funds already satisfy the selected test
- **THEN** preparation performs no extra funding or onboarding

#### Scenario: Faucet acknowledgement
- **WHEN** an authorized funding request is accepted but delivery is unverified
- **THEN** preparation remains pending and fresh recipient evidence is required for funded readiness

#### Scenario: Repeat sample preparation
- **WHEN** preparation is repeated after a partial asset issuance or delivery
- **THEN** saved operation and asset IDs are reconciled before any missing target is submitted
- **AND** completed targets are not duplicated and unrelated holdings are preserved unless deliberately targeted by the selected test

#### Scenario: Faucet cannot fund
- **WHEN** the existing faucet lacks available funds or configuration, or rejects the requested amount
- **THEN** preparation reports unavailable or incomplete with a sanitized reason and does not alter faucet secrets or invent delivery

### Requirement: Existing onboarding tool is reused
Onboarding scenarios SHALL use the separately delivered `/onboarding/` flow for account creation/restoration and conversion of existing BTC. The runner SHALL select and verify the network and requested 50% setting before automatic submission can occur. Onboarding SHALL NOT be described as a funding source. Unsupported network behavior SHALL block that scenario without blocking unrelated account tests.

#### Scenario: Half onboarding
- **WHEN** a supplied account with eligible BTC is deliberately restored into a 50% onboarding scenario
- **THEN** the selected network and percentage are verified before eligibility can trigger submission
- **AND** completion requires the intended spendable Arkade output and matching Bitcoin remainder evidence, not the intermediate whole-input Arkade balance

#### Scenario: No BTC available
- **WHEN** the selected account has no eligible BTC
- **THEN** onboarding reports the unmet precondition and does not claim to provide BTC or Arkade funding

#### Scenario: Network dependency unavailable
- **WHEN** the dropdown exists but network-specific onboarding behavior has not been verified or is unsupported
- **THEN** that onboarding scenario remains unavailable or unverified
- **AND** support is not inferred from the dropdown alone

#### Scenario: Network switch during pending onboarding
- **WHEN** a selected account has unresolved onboarding work
- **THEN** the runner preserves that account/network window and recovery records rather than resetting it with a dropdown switch

#### Scenario: Independent persistence
- **WHEN** the same registered account is used in onboarding and BIS
- **THEN** it is restored privately through each tool's own flow without copying databases or journals
- **AND** BIS readiness is established by fresh network reads independently of onboarding-local state

### Requirement: Conservative rotation and recovery continuity
Rotation SHALL require explicitly named fixtures, verified zero funds and holdings, and no unresolved operations. It SHALL archive prior encrypted identities and public generations before replacement and preserve recovery records. It SHALL NOT erase remote history, delete personal state, or treat local reset as cancellation of submitted work.

#### Scenario: Fresh-history check
- **WHEN** an explicitly selected empty wallet with verified zero holdings and no pending work is rotated
- **THEN** a fresh generation and identity replace its slot while the encrypted old identity remains recoverable
- **AND** the tool makes no claim that the old transaction history was erased

#### Scenario: Pending or funded wallet
- **WHEN** rotation targets a funded wallet, unavailable wallet, or wallet with unresolved operations
- **THEN** rotation is refused and the existing profile, identity and recovery records remain available

### Requirement: Verification evidence remains scoped and public
Reports SHALL identify fixture generation, role, network, origin, observed outcomes, and live-versus-isolated attribution without secrets. Offline success SHALL NOT establish live provider, funding, asset, or recovery acceptance. Developer tooling SHALL introduce no published fixture endpoint or production account bypass.

#### Scenario: Partial live acceptance
- **WHEN** Signet succeeds but Mutinynet is unavailable during an authorized acceptance run
- **THEN** the report records each outcome separately and does not claim both networks passed

#### Scenario: Production build
- **WHEN** published applications are built
- **THEN** the build contains no fixture secrets, vault files, automatic fixture login, or fixture control endpoint

### Requirement: Joined user sessions remain separate
The runner SHALL explicitly join a user-selected live session for public inspection and allowlisted navigation only. It SHALL verify attachment, origin and public identity, invalidate changed context, and detach without logout, tab closure or storage clearing. Creation/import, secret access, network/account switching, persistent changes, signing, submission and automatic-submission routes SHALL be denied. Test-account authority SHALL NOT transfer to joined mode.

#### Scenario: Joined public inspection
- **WHEN** the agent requests public balances, history or assets already safely accessible in the joined page
- **THEN** public results are available without secret access or agent-initiated financial mutation

#### Scenario: Navigation has submission side effects
- **WHEN** a requested route or control may initiate onboarding, contract funding, reconciliation signing or other persistent changes
- **THEN** joined mode denies that action and the agent can use an owned test session for the corresponding test

#### Scenario: Existing session unavailable
- **WHEN** the user's browser is not exposed through supported tooling or the selected live page cannot be verified
- **THEN** join reports the missing connection prerequisite without copying or restarting the user's browser
- **AND** independent owned test-session workflows remain available

#### Scenario: Registered test identity inside joined mode
- **WHEN** the joined page's public identity matches a registered test account
- **THEN** joined-mode restrictions still apply until the agent uses a separate owned test session

#### Scenario: Detach a human session
- **WHEN** the agent detaches from the selected human session
- **THEN** the user remains logged in with their storage and session state preserved
- **AND** the agent loses attachment authority

#### Scenario: Identity changes in the joined session
- **WHEN** the user changes account or origin while the agent is attached
- **THEN** captured work is invalidated and the agent verifies the new context before any permitted action
- **AND** it does not apply the standing test grant to the replacement session


## Original tasks.md

# Tasks

Planning and Grill Me review are complete. Under the user's explicit delegation, joined sessions permit public inspection and allowlisted navigation only; all account/financial mutations use owned test sessions. The user grants standing permission for supplied and agent-created test accounts throughout the ecosystem on both networks. Register supplied identities privately or create new ones. Onboarding support is delivered separately and must be verified. Checkboxes below track implementation; unchecked tasks and full live acceptance remain outstanding.

## 1. Private inventory and local entry points

- [x] 1.1 Add the `BIS/scripts/test-wallets/` command structure and npm entry point including private import and on-demand empty-account creation, with validated account, network, role, origin and scenario arguments; verify help, invalid input, unsupported-network rejection and absence of default financial mutations in command tests.
- [x] 1.2 Implement Windows-user-protected vault storage outside repository/served roots with restricted permissions, private process pipes, atomic writes and locking; verify DPAPI roundtrip on Windows, permission/protector failure, interrupted writes, and absence of plaintext files or secret output using disposable sentinel data.
- [x] 1.3 Implement private registration of the four supplied accounts, public manifest identity/generation binding, flexible distinct Player/Game assignments and network-specific observations; verify repeated/interrupted import, incompatible recovery format, duplicate identity rejection, role conflict, and mismatched-manifest rejection.
- [ ] 1.4 Create `BIS/documentation/agent-test-wallets.md` covering supplied and agent-created test inventory, private import, on-demand empty/funded scenarios, standing permission, local paths and recovery handling; verify help/init/import/status examples against disposable test storage without financial requests.

## 2. Owned browser login and isolation

- [ ] 2.1 Implement persistent Playwright ownership per network/pair with a registry for BIS applications and the game, exact origin validation and safe restart/close; verify concurrent ownership, changed-port handling, unrelated-profile preservation and independent origin storage. Register game URLs with muted audio and public package provenance.
- [ ] 2.2 Implement private Player-then-Game restoration through production hidden recovery inputs and public identity verification with configurable scenario role assignments; verify both network selections, role conflicts, operator mismatch, restore failure, reload persistence, role reassignment guards and explicit logout without automatic re-login in isolated browser checks.
- [ ] 2.3 Suppress recovery-entry traces, videos, screenshots, DOM dumps, verbose logs and raw exception output, and allowlist public status; verify injected sentinel secrets remain absent from stdout/stderr and all generated evidence on success and failure paths.
- [ ] 2.4 Implement `status --live`, `inspect`, public UI `action`, and owned-session `run --scenario` dispatch with context revalidation, bounded reads and lifecycle cancellation; verify interactions outside the catalog work in the restored session without secret export, and document commands.
- [ ] 2.5 Implement join/detach against an explicitly user-selected live page accessible through supported tooling or a supplied local debugging connection. Enforce public inspection and allowlisted navigation only; verify denied signing, secret access, settings/account/network changes, resets and automatic-submission routes, context invalidation and detach without logout/tab closure/storage changes. Test unavailable attachment and prevent ownership escalation when the joined identity matches a fixture. Document connection prerequisites and limits.
- [ ] 2.6 Add game and BIS application adapters that restore fixture identities from the private vault through production UI while retaining separate storage/journals; verify Account integration via the public package and clarify the smoke runbook's phrase-copying language to prohibit application secret export while permitting authorized vault-based test restoration.

## 3. Standing permission and recovery accounting

- [ ] 3.1 Bind the test grant to supplied and agent-created registered identities/generations across the ecosystem, supporting later revocation or limits; verify create/fund/onboard/test needs no renewed approval or budget/expiry configuration, while human joined sessions, unregistered identities and mainnet cannot inherit the grant.
- [x] 3.2 Add locked durable operation accounting with captured network, wallet, recipient, amounts and fees, and pending reconciliation across restarts; verify competing actions preserve input reservations, unknown outcomes retain recovery records and retries do not duplicate submissions.
- [ ] 3.3 Implement named payment, sample mint/delivery, burn and contract claim/refund recovery scenarios through existing BIS UI guards; verify isolated lifecycle/idempotency cases and document intentional alteration of supplied test holdings under the standing grant.

## 4. Scenario preparation and wallet rotation

- [ ] 4.1 Implement per-network readiness classification and on-demand test-account creation for empty and funded scenarios; verify previously used accounts are accepted, fresh identities inherit the standing test grant, funding is not inferred across networks and failed reads remain unavailable.
- [ ] 4.2 Implement preparation using existing funds first, optional separate faucet requests and BIS asset flows under standing permission, with retained operation/asset IDs; verify no redundant funding, acknowledgement stays pending, partial retry avoids duplicates and unrelated holdings remain untouched unless the scenario deliberately targets them.
- [ ] 4.6 Add BTC/Arkade funding from registered test wallets and supported faucet funding as separate workflows; verify exact destination/network/amount, new-account recipient evidence, retained operation IDs and honest handling of unavailable sources or interactive faucet prerequisites. Document the autonomous create → fund → onboard → use workflow.
- [ ] 4.3 Integrate the separately delivered onboarding route by driving private account creation/restoration, network selection and explicit 50% configuration before automatic eligibility submission; verify no funding is fabricated, both partial-settlement legs are reconciled, pending windows cannot be reset by network switching, and BIS rechecks readiness without database/journal copying. Document dependency on the user's network work and keep unavailable network scenarios explicitly incomplete.
- [ ] 4.4 Implement zero-holdings/no-pending rotation with archived encrypted generations and preserved journals; verify funded, pending and unreadable wallets are refused, old identities remain recoverable and new agent-created test generations retain provenance and standing permission without touching human sessions.
- [ ] 4.5 Document preparation, default 50% conversion versus separate funding, purposeful role assignments, account/network recovery, fresh-history rotation and safe rollback; add a root README link and verify commands and relative links without expanding package READMEs unnecessarily.

## 5. Integration acceptance

- [ ] 5.1 Run tooling tests, `npm run typecheck`, `npm test`, prototype faucet/onboarding tests and `npm run build`; verify production artifacts exclude fixture secrets, vault/profile files and fixture control endpoints, and record sanitized results under `output/reports/agent-test-wallets/`.
- [ ] 5.2 Verify autonomous create → fund → onboard → app-use on both networks with agent-created identities, plus supplied-account login/reload/logout/restore, assets, Player-to-Game payment and contract recovery across BIS applications and the game; verify the actual 50% settlement and public package provenance. Retain public evidence and report inaccessible accounts, unavailable sources and unperformed cases separately.
- [ ] 5.3 Verify joined-session public inspection and safe navigation against a live user-selected session, followed by detach and an owned scenario outside the fixed catalog; prove denied mutations initiate no new signing/submission, user state is not reset and no authority leaks between modes. Distinguish independent app background work from runner actions.

## 6. User-requested shared secret configuration

- [x] 6.1 Add `@bis/shared`, the canonical secret-free `.env.local.template`, Node-only consumer-key loader, Git/AI/triage exclusions, package README and rendered README route; backport all existing faucet server launch paths with explicit process-environment precedence and legacy fallback only when the shared file is absent, preserving existing private files.
- [x] 6.2 Add `test-wallets import --shared` for the four supplied account slots directly into the encrypted vault; verify empty slots, incompatible input, repeat registration and no secret output without reading actual populated files in tests.
- [x] 6.3 Verify workspace/lock registration, shared-loader and faucet tests, Vite secret-serving denial, documentation links, typecheck and build; retain public results and leave actual population to the user.


## Original design.md

# Design

## Context

See proposal.md for motivation. The existing account adapter generates BIP39 mnemonics, derives public profile IDs, validates the configured operator's reported network, and creates transient SDK wallets. Player and Game Wallet secrets are encrypted in separate network-specific IndexedDB databases. LocalStorage also holds preferences and recovery records; copying only localStorage cannot reproduce a session.

The private Player restore view and Game Wallet restore view already handle secret input and enforce distinct roles. The user-facing Game Wallet flow requires a connected player, so restoration must select the network, restore Player, and then restore Game. Current storage code and some older specs differ on retained identities after logout; the runner must observe actual public state and explicitly restore as needed, without depending on retention or changing logout semantics.

The existing prototype faucet offers a local funding helper with explicit network, address, amount, and idempotency key. It accepts 50k, 100k, or 200k sats and distinguishes acknowledgement from delivery. This is source-level feasibility evidence, not a fresh live verification of either operator. Current network capabilities and faucet funding must be checked during authorized acceptance; failures remain unavailable.

The user has prepared four previously used funded accounts and explicitly authorized unrestricted test use of those accounts on Signet and Mutinynet on 2026-10-11. Their actual private access location and public identities have not yet been registered by this workflow. Do not search arbitrary files or browser profiles for secrets; registration uses a deliberately supplied private source.

The standalone `/onboarding/` route can create or restore mnemonic accounts and convert existing BTC to Arkade. It does not fund either balance. Its default is 50%, adjustable from 1 to 100. Partial onboarding boards captured inputs and returns the non-target remainder in another settlement; the intermediate Arkade balance is not completion. The separate `redesign-developer-onboarding-faucet` work now includes a dropdown and network-specific code in the current working tree, but its planning text and older README still describe Signet limits. Consume the delivered behavior after per-network verification; this change neither resolves that other change's artifacts nor implements its network support.

## Goals / Non-Goals

**Goals:** Autonomous creation, funding, onboarding and application use for supplied and agent-created test identities throughout the BIS ecosystem; purposeful scenario selection, private login and recovery continuity; a separate limited mode for joining the user's selected live session.

**Non-Goals:** Production custody, a new signer endpoint, published fixture buttons, a game API change, importing personal browser profiles into the fixture vault, financial submission merely from opening Admin/Marketplace, copying browser databases or journals between applications, or implementing the separate onboarding network feature.

## Decisions

### 1. Local command runner with named fixtures

Add `BIS/scripts/test-wallets/` and an npm `test-wallets` command with `init`, `import`, `create`, `status`, `open`, `inspect`, `action`, `run`, `fund`, `prepare`, `join`, `detach`, and `rotate` subcommands. `create` supports empty and funded scenario preparation; creation itself does not imply successful funding. `init` initializes storage without generating replacements for the four supplied accounts. `import` consumes a deliberately supplied private local input inside the runner, validates compatible identity material, and encrypts it without sending the secret through chat, shell arguments, or reports. Idempotent re-import retains identity and journals; duplicate identities cannot masquerade as distinct Player/Game signers. Use neutral public labels such as `test-account-1` through `test-account-4`, not assumed network funding labels. Private material not supported by production restoration yields a specific unsupported-input result without changing existing slots.

`status --live` performs current public reads; `run --scenario` executes a named scenario within the owned session. Initial scenarios cover reload/logout/restore, a Player-to-Game payment, sample mint/delivery, 50% onboarding, and contract claim/refund recovery using existing controls. Map any two distinct registered identities to Player/Game for a scenario; the same identity's Signet and Mutinynet observations are separate records. Reassign roles only after pending work is reconciled and normal logout/restoration guards allow it.

Owned sessions also expose `inspect` and `action` for public UI navigation, form input and activation so the agent is not limited to a fixed scenario catalog. Each action captures session ID, application origin, public wallet scope and mode; revalidate these before execution. Private restore inputs are handled internally, never supplied through chat-facing action arguments. Financial intent is durably captured at existing submission boundaries. Session transport stays local to the runner; never expose a generic signing or browser-control HTTP endpoint in the app. Raw browser evaluation or arbitrary selectors are not a joined-mode escape hatch.

Create additional registered test identities for empty-state or funded scenarios through existing account flows, including the onboarding tool where appropriate. Each identity records provenance as supplied or agent-created and inherits the user's standing test permission. Retain reusable supplied accounts and prior data. No command drains a funded account merely to label it empty. Alternatives: eight mandatory generated accounts would ignore the supplied inventory; generating every wallet for every run would lose recovery continuity.

### 2. Windows user vault outside served directories

Store encrypted secrets and browser profiles in a validated application-data directory for this repository, outside repository roots, Vite filesystem allowances, and `output/`. Protect the vault using Windows user-scoped DPAPI through a small PowerShell helper and restrict filesystem permissions to the current user and required system access. Fail closed if the protector or permissions are unavailable; no plaintext fallback. Pass secret bytes through private process pipes, never CLI arguments, stdout, environment dumps, or temporary plaintext files. The runner consumes decrypted bytes internally and exposes only an allowlisted summary to the agent.

Keep a separate public manifest of account labels, public profile IDs, generations, authorization provenance and scenario role assignments, plus network-specific observed readiness. Verify manifest identities against encrypted records before use. Vault writes are atomic and serialized. Backups retain encrypted vault data only.

On 2026-10-11 the user explicitly requested one Shared package and `.env.local.template`, superseding the earlier rejection of a repository-local environment input. `BIS/packages/shared/.env.local` is now the canonical developer-supplied source for both faucet signer mnemonics and the four supplied test-account slots. The template contains no usable secrets. Exclude the populated file from Git, AI and triage; block environment paths before Vite routing/raw imports. This source is plaintext local input, not encrypted runtime storage, and requires private OS permissions. Do not inspect, print, migrate or delete existing secret values during template setup. The user will populate it.

The Node-only shared loader exposes explicit consumer key sets. Faucet server entry points consume faucet keys; `test-wallets import --shared` consumes only supplied-account keys directly into the encrypted vault. Never register faucet signers as fixtures or pass shared secrets to a browser bundle. Existing process environment values take precedence. Use the old faucet `.env.local` only while the shared file is absent; do not silently merge missing/blank shared entries from the old source. Backport direct server startup, the root launcher, standalone Vite lifecycle and funding helper; no existing credential file is removed. Agent-created identities are never exported into the plaintext source. The shared package has a named README rendered at `/shared/`, not a browser application.

### 3. Dedicated persistent profiles, existing UI, no login backdoor

Use Playwright persistent browser contexts for each network/scenario pair and explicitly configured BIS loopback origin. Record exact scheme, hostname and port; a changed port is a different origin and requires fresh explicit login, not renewed test-spending permission. Admin and Marketplace share the pair's same-origin state. Drive existing hidden recovery fields internally, with tracing, video, screenshots, DOM snapshots and verbose automation logging disabled for secret entry. For standalone onboarding manual restoration, handle the existing private input prompt within the same capture-suppressed runner. Sanitize exceptions and page logs before output. Only resume public evidence capture after recovery UI and transient inputs are cleared.

The owned runner browser session provides follow-on operations and public inspection through named commands/scenarios, so login is not stranded in a profile inaccessible to the agent. Serialize ownership; never attach the profile to a second automation browser concurrently. External browser tools without ownership do not receive a profile or storage dump. No production module gains a fixture export, secret endpoint, or dropdown. Ordinary product restore and logout behavior is preserved. Browser-state injection was considered but rejected because it bypasses validation and lifecycle behavior.

Add an application registry for Admin, Marketplace, Onboarding, Faucet and the game, with explicit origin/path adapters and public package provenance for the game. Restore registered test identities independently through each application's normal private UI, sourcing phrases directly from the fixture vault; never export/import browser databases or operation journals. Keep per-application recovery context, check global runner work for that identity/network before conflicting actions, and verify current network state rather than treating another app's journal as authority. Include `muteMusic=true&muteSFX=true` in automated game URLs. The old smoke runbook's broad ban on phrase copying needs clarification during implementation to distinguish private vault-based restoration from exporting secrets out of an application.

Provide `join`/`detach` for an explicitly user-selected live page already accessible through supported browser tooling or an explicitly supplied local debugging connection. Verify the live page handle, origin and public identity; a profile path or URL alone cannot prove attachment to the user's session. Do not launch, restart, copy or unlock a personal browser to fabricate attachment. If an existing session is not exposed to a supported connection, report the connection prerequisite and use an owned test session for independent work. Tool metadata confirms page-listing and per-page targeting exist in the available Chrome tooling; actual attachment must still be demonstrated during acceptance.

Joined mode permits public inspection, scrolling and explicitly allowlisted navigation with no financial or persistent user-setting effects. It prohibits creation/import, account or network switching, secret reveal/copy, signing, submission, logout, reset, and gameplay actions that initiate funded contracts. Verify navigation side effects from each adapter: the onboarding route can submit automatically, and contract refresh/reconciliation can go beyond a passive read. Deny unknown controls and automatic-submission routes rather than treating all navigation or Refresh buttons as read-only. Existing background app work may continue independently; the runner promises not to initiate new mutations, not to freeze the user's application. Invalidate work on identity/origin change and detach without logout, tab closure, or storage clearing. Never import joined wallet material into the vault or label a joined session test-owned, even if its public identity is registered. This choice resolves Question 1 under the user's explicit instruction that the agent can choose limits.

### 4. Honor standing test authorization

Bind the user's standing authorization to verified supplied and agent-created test identities and their generations throughout BIS applications and the game. It covers account creation, funding, onboarding, transfers, spending, minting, burning and contract creation/claim/refund on both supported networks. Mandatory budgets, expiry, per-action approvals and recipient allowlists are removed. Test recipients and amounts are scenario inputs recorded publicly; test holdings can be deliberately altered. Revocation or later user limits take precedence. Unregistered identities, personal accounts, mainnet and unrelated faucet signer credentials remain outside this grant. Joining a human session never silently converts it to a test session, even if a public identity appears in the test registry.

Record a durable public operation ledger with operation identities, recipients, amounts, fees and original wallet/network scope before submission; use exclusive coordination to avoid conflicting actions. Pending and unknown outcomes retain their recovery records until reconciled. Existing BIS input reservations and fee/policy guards remain effective. Loading an Admin/Marketplace pair never triggers replenishment. `prepare` can describe a plan and execute a selected test under the existing standing grant without a second human approval. Onboarding's automatic submission on eligible funding is part of deliberately starting an onboarding scenario and must be accounted for before restoring a funded account into that route.

The registry records authorization and recovery continuity; it is not a security boundary against malicious same-user code or direct browser control. Production BIS guards still validate network, roles, inputs and unresolved operations. A mandatory budget engine was rejected because the user explicitly permits autonomous use of supplied and agent-created test accounts.

### 5. Preparation describes real observations

`prepare` accepts targets for spendable sats, sample asset definitions/quantities and selected scenario. Inspect existing BTC and Arkade balances first. For BTC-to-Arkade preparation, explicitly select the account, network and 50% setting in `/onboarding/` before eligible funding can trigger automatic execution; do not rely on a remembered slider. Capture input scope and preserve both legs of partial settlement. Opening a funded account there can initiate a transfer; therefore read-only inspection uses non-mutating BIS surfaces. Use a separate owned onboarding window per account/network; do not switch its dropdown while work is unresolved. Restore the same registered mnemonic privately where needed, never copy IndexedDB databases or operation journals between onboarding and BIS. Read network evidence again in BIS after completion; onboarding-local IDs do not prove BIS readiness.

The onboarding route creates/restores and converts existing funds; it supplies neither BTC nor Arkade funding. Funding is a separate autonomous workflow: use the configured prototype faucet for Arkade funds or a registered test wallet's normal send flow for BTC/Arkade funding of another test account. Keep address, network, amount, operation ID and recipient verification explicit. External BTC faucets remain a separate fallback; interactive login/CAPTCHA or unavailable source funds must be reported as blockers, not bypassed or presented as successful automation. Do not configure or repurpose unrelated faucet signer secrets. Account for pending requests and reconcile the original operation before retrying. Use existing mint/delivery UI for sample assets with retained IDs. Preserve unrelated holdings unless deliberately targeted by a test.

Record `ready`, `empty`, `pending`, `unavailable`, `dirty`, or `incomplete` with safe reason codes and observation timestamps. Previously used accounts are expected and are not assumed pristine. Funding and history are observed independently for each network. Unavailable reads are never zero. A successful faucet acknowledgement or onboarding registration remains pending until recipient/settlement evidence verifies the intended result. Recovery scenarios deliberately create and reconcile operations through normal behavior; they do not fabricate journals or outcomes. Exact asset names and amounts are scenario parameters the agent can choose under the supplied grant.

### 6. Preserve recovery before rotation

Keep funded browser profiles and operation ledgers for continuity. `rotate` requires explicit target fixture IDs and refuses wallets with unresolved operations or unverified balance/inventory; require observed zero sats and no holdings before replacement. Archive old encrypted records and public generations for recovery; do not delete remote history or claim local clearing cancels a transaction. Never touch personal profiles, faucet wallets, or other projects. Resetting scenario UI state does not erase durable pending journals. Fresh-history checks rotate eligible empty wallets rather than erase transaction history.

## Risks / Trade-offs

- Same-user malware or compromised origin can sign with restored wallets → restrict owned sessions to registered supplied or agent-created test identities and isolated profiles; no claim of production key security.
- Automation can leak hidden input through traces or exception call logs → internal secret handling, capture disabled around entry, sentinel leak checks on failure paths.
- Network services or faucet funds are unavailable → bounded reads and honest blocked acceptance; no fixtures substituted for live results.
- Persistent profiles can be locked or carry unresolved work → exclusive ownership, explicit reconciliation, conservative rotation.
- Existing unrelated wallet/readiness edits are in progress → implement tooling against settled public behavior without overwriting those changes.
- Windows DPAPI limits portability → this first slice targets the supplied Windows environment; other hosts report unsupported vault protection until a separate provider is implemented.
- Onboarding network changes reset page state and can strand pending context → isolate windows, preserve recovery, and verify the separately delivered network behavior before enabling Mutinynet onboarding scenarios.

## Migration Plan

Ship opt-in developer scripts, application adapters and documentation. Initialize the vault, privately register supplied or newly created test accounts, verify public IDs, record the existing grant and inspect balances per network. Verify onboarding's dependency and game package provenance before live scenarios. Missing access material blocks that import, not agent-created-account workflows. Rollback stops owned test sessions or detaches joined human sessions; preserve vaults and recovery records until requested disposal. Published deployments contain no fixture secrets or tooling endpoints.

## Interview Outcome and Acceptance Prerequisites

The user delegated joined-session limits to the agent. Question 1 is resolved as public inspection and allowlisted navigation; all test mutations belong in owned sessions. Supplied and agent-created test identities have standing authority across the BIS ecosystem on both supported networks. The agent may choose roles, test data, amounts and recipients without new spending approval. No further preference decision is required to implement this design.

Actual private account access, available funding source balances, per-network onboarding outcomes, and a live exposed user-selected browser session are acceptance prerequisites, not assumed facts. A missing supplied secret must not prevent creating and funding another test identity; a browser connection unavailable for join must not prevent owned-session work. Record missing prerequisites precisely, retain the full acceptance scope, and do not claim the objective complete until the required live flows are demonstrated.
