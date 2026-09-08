## Context

See proposal.md for motivation. App.start creates one player context; createBisAdminContext wraps that same context. Account storage hardcodes one IndexedDB database and broadcast channel. SDK adapters already instantiate separate in-memory repositories. Logout cleanup scans shared journal prefixes. Before this change, continuation created a transient recipient on each new attempt and persists a send quote for reconciliation.

## Goals / Non-Goals

Goals: independently retain the operator's game wallet, inspect genuine incoming funds, and replace new sink payments with explicit configured recipients without weakening recovery.

Non-goals: server hosting, automatic signing, wallet deletion controls, new minting behavior, trophy/control-asset policy, automatic Bitcoin boarding, or stronger gameplay anti-cheat.

## Decisions

### Separate Admin lifecycle

Add an Admin-only game-wallet controller backed by a separate encrypted account storage namespace (`bis-game-wallet-signet-v1`) and scoped broadcast channel. Reuse existing mnemonic validation/identity derivation and address/balance adapters. Expose only import, public state, Refresh, subscription and disposal to demo composition; never expose the phrase in state or logs. Keep the default player storage name and record format unchanged. Do not call the unmodified public context factory twice: that would share an identity slot.

Import uses one recovery-phrase text field, cleared after use; invalid import leaves existing state intact. Retain encrypted identities keyed by profile ID and a separate last-selected profile pointer within the game-wallet namespace. Importing a different identity adds it and selects it without overwriting earlier identities. Re-entering a retained identity selects it without creating a duplicate. Restore the last selection on reload and fetch its current balance. No wallet dropdown, wallet creation or deletion is included. Selection changes cancel or ignore stale address/balance reads so the previous wallet cannot populate the new selection. F1 exposes wallet inspection; F2 separately extends the controller for explicit payment and F3 adds explicit boarding. No mint/reset action is added. Reject importing the current player identity as the game wallet, and reject self-payment at submission if the player later restores that identity. This preserves an independently demonstrable payer and recipient.

Player logout/reset must not clear game identity, metadata or future game-operation namespaces. Keep current player journal semantics and mutation coordination intact; do not broaden deletion or implement a database migration. Sender-scoped send/boarding journals are preserved with game-wallet ownership markers during player cleanup. Cross-tab notifications for game import must not hydrate or log out the player context.

### Admin presentation

The F. Game Wallet section contains an F1. Game Wallet row with actions to the right. Initially show Import, opening one recovery-phrase field. After import, replace Import with Details and Logout. Details performs a fresh read and sends an explicit public-only projection (profile ID, receiving addresses, balance, recipient configuration and mismatch/read status) to the Admin console. Remove inline address/balance fields and separate Copy/Refresh buttons. Logout writes a null selection, broadcasts the selection change and clears in-memory presentation; retain encrypted identities for re-import. The player and payment recipient are unaffected. Show payment-usable balance immediately left of Details, including zero for unresolved-operation spending locks; Details includes raw balance and payment status. Subscribe through the SDK RestIndexerProvider script subscription for the receiving address, refresh from authoritative balance reads on events, and stop via AbortSignal plus unsubscribe on logout/switch/disposal. For balance subscriptions no polling timer or onchain polling fallback is added; stream failure removes stale live balance and Details retries. F3 adds explicit Board Wallet and status-only Details. Its read-only waiting probe checks live onchain transactions immediately and every 15 seconds, matching recorded inputs and commitment ID. Only live unconfirmed evidence disables Board Wallet with (Awaiting Confirmation); failures and wallet switches clear that in-memory indication. No persisted boarded flag is introduced.

### Public recipient configuration

Add optional `continueRecipient` to `createBisContext` options as an opaque address string; validate the Signet Arkade recipient in the adapter. The game consumes public build configuration. The demo updates its recipient reference from the selected game wallet and its localhost-only development endpoint saves only the validated public address to both projects. Production configuration changes require the local Admin and a rebuild. No signing service, key-bearing environment variable or GitHub Secret is used. Missing/invalid configuration disables new Continue payments with an explanation; other account features remain available. Existing host factory calls without options remain valid.

Capture the validated recipient on each new continuation request before journaling/submission. Add a recipient binding to the new request/record representation and a `game-wallet-payment` result mechanism. Retain `sink-payment` only for historical results. Freeze recipient together with operation ID, profile, sats and continuation context. Duplicate-ID input changes must fail; config changes never redirect an existing operation. Continue to use existing verified send amount/output and asset-preservation checks. Do not generate a fallback wallet.

Keep legacy record readers and reconciliation: previously submitted sink payments use their stored send quotes, even without current recipient configuration. A legacy record with no send evidence follows the existing definitive-not-submitted handling; do not restart it against a new recipient. Updated controller success matching includes the recipient for new records while preserving old result recovery and at-most-once callbacks.

### Consumer delivery

Update demo and Stealth to pass the configured public address into BIS, refresh Stealth's pinned BIS dependency using its existing release mechanism, and preserve current price, defeat menu, toast and session rules. No gameplay wallet credentials are embedded. The deployed game must work without the Admin tab being open.

## Risks / Trade-offs

- Browser-held credentials remain accessible to code on the same origin; encrypted storage is the existing demo protection, not production custody. Never capture import fields in test screenshots or logs.
- Provider delays can postpone Admin balance visibility; show honest loading/error state and verify receipt through fresh reads rather than incrementing balances locally.
- Public recipient changes require rebuilding hosts; display mismatches and preserve pending destinations.
- Shared storage cleanup is a regression risk; test player logout/reset and cross-tab behavior with distinct wallets and pending player operations.
- Two-wallet live behavior is not yet verified; completion requires a real Signet transfer with recorded public transaction evidence.

## Migration Plan

Deliver wallet setup first, then configured payments. Keep existing player records untouched and read legacy continuation records additively. Publish the configured demo and update the named game consumer. If verification fails, disable new Continue payments in the host while retaining account access and reconciliation; do not revert to sink fallback or erase journals. Documentation moves the former X1 story to F1 under F. Game Wallet and updates its current links. Leave historical change directory names intact. Do not renumber the other appendix stories as part of F1; the deferred trophy X2 naming collision stays recorded in its proposal.
