## Why

BIS is currently a Signet-only experience: its Arkade endpoint, derivation, encrypted-store names, UI labels, and test-only guidance all assume Signet. Adding Mutinynet without an explicit origin-wide selection would allow the Player Wallet, Game Wallet, diagnostic reads, and contract activity to describe different networks as though they belonged together.

## What Changes

- Add a first-class **Signet / Mutinynet** selector before any Player Wallet or Game Wallet create, restore, or diagnostic connection begins. The selected network remains conspicuous in account, admin, and workflow labels.
- Make funding guidance network-specific and user-directed. For Mutinynet, provide the current boarding Bitcoin address in a copyable `mutinynet-cli onchain <address> [sats]` command after explaining that the user must first complete the CLI's GitHub device login; also retain the live Mutinynet faucet as a manual fallback. For Signet, provide the Bitcoin Core `contrib/signet/getcoins.py --addr <address>` helper and explain its interactive CAPTCHA; retain the live Signet faucet as the manual fallback. BIS never executes either CLI, handles a Mutinynet token, or requests faucet funds automatically.
- Route the selected network through operator health verification, identity/address derivation, Arkade provider and indexer calls, balance and activity reads, asset operations, onboarding readiness, and contract/LTO operations. Reject an operator whose reported network differs from the selection; unavailable or mismatched evidence is not healthy.
- Make Player Wallet and Game Wallet a single-network pair. A Game Wallet login/create/restore is available only after network selection and must use the current Player Wallet network; a Player Wallet flow similarly rejects a Game Wallet from a different network.
- Make changing the network a deliberate security boundary: cancel ongoing work, log out both active wallets, clear their active encrypted sessions plus in-memory account, diagnostic, and operation state, then require fresh login on the newly selected network. Preserve only the non-sensitive selected-network preference in browser local storage; retained encrypted records and browser keys are network-scoped and must never be read as another network's state.
- Change Player Wallet logout to log out the Game Wallet as part of the same confirmed cleanup, while preserving remote funds and never claiming cancellation of submitted work.
- Update tests and README/runbook material to describe BIS as a browser-only diagnostic tool for **Signet and Mutinynet** test networks. Mainnet wallet support is explicitly out of scope.

## Capabilities

### New Capabilities

- `test-network-selection`: Origin-wide Signet/Mutinynet choice, visible network context, verified endpoint routing, cross-network isolation, and safe switching for every BIS wallet and diagnostic workflow.

### Modified Capabilities

- `account-entry`: Replace fixed Signet form messaging with the selected, consistent test-network context and gate first wallet entry on selection.
- `account-creation`: Create and commit a Player Wallet only after a selected network passes its operator check, using that network's derivation and isolated persistence.
- `account-restoration`: Restore a Player Wallet only on the selected verified network and retain no cross-network active state.
- `account-logout`: Make confirmed Player Wallet logout also complete Game Wallet logout and clear both active local sessions safely.
- `admin-game-wallet`: Require the Admin Game Wallet to share the selected Player Wallet network and clear it when Player Wallet logout or a network switch occurs.
- `game-wallet-restoration`: Gate Game Wallet create/restore on network choice and bind the private recovery flow to the selected test network.
- `account-address-sending`: Validate recipients and review text against the currently selected test network rather than hard-coded Signet.
- `account-assets`: Scope asset reads, network labels, and asset-operation presentation to the selected verified test network.
- `account-automatic-onboarding`: Scope readiness, funding guidance, endpoints, and live acceptance evidence to the selected verified test network.

## Impact

- Core/Arkade: `account.ts`, provider construction and endpoint configuration; address, balance, activity, asset, onboarding, and contract adapters; Player and Game Wallet storage/session lifecycle; composition in `bis-game-services.ts`.
- React/demo: account entry and recovery pages, Game Wallet UI, Admin panel, shared network headers, contextual labels, and network-switch feedback.
- Browser security: only a non-secret network preference is shared through local storage; encrypted records, selection state, BroadcastChannel names, and in-memory caches are network-scoped or cleared at the boundary.
- Verification/docs: focused unit/browser-host coverage for both directions of the selector, endpoint mismatch, cross-wallet network rejection, switch/logout cleanup, and network-specific workflow routing; README and operator runbook updates. A compatible Arkade SDK configuration surface and public Mutinynet endpoints must be confirmed during implementation; the current package is hard-wired to Signet.
