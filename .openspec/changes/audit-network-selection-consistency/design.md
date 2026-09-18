## Context

See [proposal.md](proposal.md) for motivation and the delta specifications for requirements. The network registry, account envelope, account-aware address/balance/activity adapters, and portions of the asset adapter already accept `TestNetwork`. The audit found remaining fixed Signet providers in boarding, sending, funding, Game Wallet events, reservation recovery, and LTO contracts; Signet-only journal/lock prefixes; and fixed presentation/error strings. The existing `add-bis-test-network-selection` change is in progress and defines the overall selector/lifecycle direction; this change closes its routing and isolation gaps.

## Goals / Non-Goals

**Goals:**

- Make the network carried by an account, Game Wallet, contract record, or operation record the only route-selection source at an operation boundary.
- Centralize route creation and network assertion so individual adapters cannot quietly choose a default operator.
- Preserve legacy Signet records only in the Signet scope while preventing new cross-network coordination or stale callbacks.

**Non-Goals:**

- Add Mainnet, custom operators, automatic faucet funding, record migration between test networks, or a game-facing Arkade type.
- Change confirmed remote transaction semantics or surface private wallet material.

## Decisions

### 1. Use a shared verified account-network provider factory

Create one internal factory that receives `AccountSecret` plus an abort signal, derives the operator/indexer/explorer configuration from `account.network`, and asserts exact operator identity before yielding providers. Migrate every remaining direct `SIGNET_OPERATOR`, `requireSignet`, and default `Rest*Provider` construction in production wallet adapters to it.

The existing registry remains the source of labels, URLs, and address/network rules. Adapter-local defaults are retained only at backward-compatible pure-formatting APIs; live wallet reads and mutations receive an explicit account/session network.

Alternative considered: patch each fixed URL independently. Rejected because the C1 defect demonstrated that a single missed argument routes a funded wallet to the wrong operator.

### 2. Make operations and observers carry a network scope

Extend operation/journal key constructors, locks, reservations, recovery records, LTO attempt markers, contract filtering, and event observer inputs with a `TestNetwork` scope. Completion guards compare profile identity, selection generation, and network before publishing or writing. Existing untagged Signet keys are read only through an explicit legacy-Signet compatibility path; Mutinynet never reads them.

Alternative considered: keep global prefixes and add network fields only to JSON payloads. Rejected because stale locks and key discovery occur before payload parsing and would still cross-contaminate operations.

### 3. Bind Game Wallet and LTO services to the current shared network

Change Game Wallet event observation and dependent Admin services to accept the selected account/network context rather than an address alone. LTO creation and recovery derive their contract scope, storage, locks, and provider routes from the active Player/Game network, then reject a pair or delayed callback whose network differs.

Alternative considered: leave contracts Signet-only while other surfaces support Mutinynet. Rejected because the Admin would present a mixed-network wallet pair as one coherent system.

### 4. Derive visible network wording from the registry

Replace fixed Signet errors, address requirements, headers, funding confirmations, and documentation labels with registry-backed selected-network text. Generic errors remain sanitized; labels describe the current network without revealing recovery material or raw SDK exceptions.

Alternative considered: retain static Signet wording as legacy copy. Rejected because it falsely explains an active Mutinynet operation.

## Risks / Trade-offs

- [Legacy Signet journals lack an explicit network] → recognize them only through a narrowly tested Signet compatibility layer; never infer Mutinynet.
- [Provider factory migration affects financial operations] → test each adapter's constructed URLs, exact-network assertion, failure path, and no-submit guard before live smoke checks.
- [LTO and recovery have long-lived callbacks] → make network scope part of each currentness predicate and stop observers on lifecycle change.
- [Some public Mutinynet routes may be unavailable] → report a sanitized unavailable result; never retry through Signet.

## Migration Plan

1. Inventory direct network constants/defaults and classify them as provider, validation, durable-state, callback, or presentation use; add a test matrix before replacing routes.
2. Introduce the verified provider/network-scope helpers and migrate regular account, Game Wallet, asset, boarding, sending, funding, and recovery adapters.
3. Migrate LTO/contract persistence, locks, reconciliation, and observer lifecycles; add cross-network stale-result tests.
4. Replace remaining fixed labels and update documentation; run focused suites, typecheck/build, and a non-mutating browser diagnostic for each network.
5. Roll back by retaining the prior tested Signet path only if a regression is found before release; do not convert or delete any persisted wallet or operation data.
