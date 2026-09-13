## Context

See [proposal.md](proposal.md) for motivation. BIS currently embeds `SIGNET_OPERATOR`, a Signet-only check, Signet-specific encrypted IndexedDB names/AAD, and static Signet UI text. The Player context owns account lifecycle and logout; the separately composed Game Wallet owns its own encrypted selection and subscriptions. All Arkade adapters currently construct their own account/provider path from the implicit Signet assumption.

The product remains browser-only and must keep the game-facing API free of Arkade-specific types. The current pinned SDK is `@arkade-os/sdk` 0.4.72; its local integration is only proven against Signet. Public Arkade examples identify `https://mutinynet.arkade.sh` as the Mutinynet operator, but every configured endpoint remains subject to the runtime `/v1/info` exact-network verification before it can be used.

## Goals / Non-Goals

**Goals:**

- Carry one immutable `TestNetwork` context (`signet` or `mutinynet`) through every wallet and diagnostic operation, rather than passing bare URLs or relying on module constants.
- Make network switching and Player Wallet logout coordinated lifecycle boundaries for the Player Wallet and Game Wallet.
- Make visible network context, persistence separation, and diagnostics resilient to stale cross-tab or delayed async work.

**Non-Goals:**

- Supporting Bitcoin mainnet, arbitrary/custom operators, cross-origin wallet sharing, automatic network migration, or recovery-phrase export.
- Treating a network switch as cancellation, settlement, or deletion of a submitted remote operation.
- Changing the Player/Game Wallet identity-role separation rule; wallets still require distinct public profile IDs.

## Decisions

### 1. Introduce a single test-network registry and session coordinator

Create an internal registry with exactly two entries: Signet and Mutinynet. Each entry contains the network ID, user-facing label, public Arkade operator route, and network-specific explorer/faucet metadata. A `TestNetworkSession` coordinator owns the selected value, preference load/store, subscribers, and a monotonically increasing session generation. The coordinator exposes only network IDs and non-secret state to UI/hosts.

The preference is stored under one dedicated local-storage key and is the only data this feature persists in local storage. First use has no implicit default: the Account/Game Wallet entry flow renders the selector. Later uses can show the preference preselected, but all activated wallet state must still match it.

Alternative considered: keep a Signet default and add a network dropdown after login. Rejected because creation/restoration would already have connected and derived state before the choice, and the two wallets could become mixed.

### 2. Make verified network configuration an explicit Arkade dependency

Replace module-level Signet constants and `requireSignet` with a network-aware provider/account factory. It fetches the selected operator's info with the existing deadline, requires exact equality with the selected network ID, then creates the Arkade provider and wraps its info read with the same assertion. Address, balance, activity, asset, onboarding, payment, and contract adapters receive the immutable verified configuration or an account/session carrying it; they never choose endpoints independently.

Mutinynet configuration uses the known public operator route only as a candidate. Implementation acceptance must exercise the installed SDK's Mutinynet configuration and verify `/v1/info` plus the SDK provider's info response before enabling a real flow. If the installed SDK cannot support the network without a compatible upgrade, the implementation stops at a truthful unavailable diagnostic rather than silently falling back to Signet.

Alternative considered: append a `network` query field to current calls. Rejected because provider/indexer routing, derivation, and SDK-created wallet state remain implicit and would still permit a cross-network result.

### 3. Namespace all durable and live state by network

Derive account and game-wallet database names, encrypted AAD, BroadcastChannel names, cache keys, operation journals, onboarding records, and contract records from the selected network. Add a network tag to encrypted envelopes and reject records whose tag does not match the active session before decrypting. Records must not be copied or migrated during selection changes.

Each asynchronous request captures both wallet selection generation and network-session generation. Completion verifies both before publishing, writing, or scheduling another read. The existing origin-scoped wallet-role lock gains the network session boundary so Player/Game Wallet identity comparison happens only inside the same network scope.

Alternative considered: retain one database and add network filters to reads. Rejected because a missed filter could decrypt/use data on the wrong network; physically separate names and AAD make the unsafe interpretation fail closed.

### 4. Coordinate Player logout and network changes as paired local cleanup

Add a private lifecycle coordinator composed with both wallet controllers. For Player logout, after existing acknowledgements it freezes the shared session, aborts Player/Game Wallet work and subscriptions, persistently deselects/logs out the active Game Wallet, then clears the Player Wallet profile and journals. It verifies both results before publishing successful disconnection/restart. A failure leaves the UI in a retryable failed cleanup state and does not claim partial success.

Network switching follows the same suspension sequence, clears active Player/Game Wallet selections plus in-memory diagnostic/operation state, commits the non-secret preference only after cleanup, and resumes in logged-out state. Other encrypted per-network records stay isolated but are never activated automatically by this switch; a fresh selected-network login is required. Cross-tab notifications carry only the network ID/session revision and cause observers to abort/remove prior-network presentation.

Alternative considered: call the two existing logout methods independently from React. Rejected because ordering, errors, and cross-tab races could leave one wallet alive or publish a newly selected network while a previous provider callback is still active.

### 5. Surface one network context at all entry and diagnostic boundaries

Add a reusable selector/header model shared by Player Account, Game Wallet recovery, Admin Game Wallet, and diagnostic/account detail routes. Static `Network: Signet` strings become the selected label, and test-only warnings/faucet/explorer links come from the same registry. Mutinynet funding guidance derives a copyable `mutinynet-cli onchain <address> [sats]` command from the current boarding address, explains that the user completes the CLI's GitHub device login, and retains the live manual faucet link. BIS renders/copies this guidance only; it neither launches the CLI nor handles its token. Mutation controls remain disabled until a selected network is verified for the operation; ordinary gameplay remains usable when diagnostics are unavailable.

Alternative considered: only label the wallet login screen. Rejected because a balance, asset, onboarding, or contract result could appear later with no way for the user to determine which network it represents.

## Risks / Trade-offs

- [The pinned SDK has only been exercised on Signet] → add a configuration capability check and real Mutinynet smoke path before claiming any operation available; fail closed on unsupported SDK behavior.
- [Paired cleanup spans two encrypted stores] → suspend both controllers first, perform ordered cleanup, verify both persistent results, and keep retry/error state until confirmation.
- [Previous-network asynchronous work arrives late] → capture and compare session plus wallet generations at every durable/published boundary.
- [The browser preference is edited or corrupted] → validate strictly to the two network IDs; treat any other value as no selection and do not contact an operator.
- [Existing Signet data has no network tag] → treat it as legacy Signet only after a safe migration/read validation; never reinterpret it as Mutinynet.
- [Network-specific faucet/explorer URLs drift] → keep them in one registry and test rendered links/labels per supported network.
- [CLI guidance could be mistaken for an automated funding action] → label it as a user-run command, require explicit clipboard copy, explain the user-owned device login, and retain a manual faucet option.

## Migration Plan

1. Add the registry, session coordinator, and isolated storage-key/envelope scheme with deterministic tests; safely recognize existing encrypted Signet records only in the Signet scope.
2. Thread verified network configuration through Arkade account/provider construction and every read/mutation adapter; add mismatch and stale-generation tests before enabling the selector UI.
3. Compose paired cleanup into Player logout and network switching; extend Player/Game Wallet unit and browser-host tests for both tabs and delayed callbacks.
4. Update Account, Game Wallet, Admin, and diagnostic headers/warnings, including Mutinynet's user-run CLI funding guidance and manual faucet fallback; document both test networks, endpoint health expectations, and the browser-only/no-mainnet boundary.
5. Verify Signet regression and a live Mutinynet diagnostic/login/read path separately. Roll back by disabling the Mutinynet registry entry and preserving Signet isolation; never route a failed Mutinynet selection to Signet.
