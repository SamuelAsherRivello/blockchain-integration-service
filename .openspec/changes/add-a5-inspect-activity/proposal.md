## Why

Refreshing Account Details balances does not explain whether an incoming transaction has been detected. A5 should give the player a minimal, copyable view of all transaction history Arkade supplies, including incoming funds before they become spendable.

## What Changes

- Add Account Activity directly below Account Details in Account. Open an Account Activity dialog with Account ID at the top, then a Transactions label with one Copy button and one read-only multiline text area. Each transaction occupies one line with amount in sats, Incoming/Outgoing direction, supported status, and the available transaction/output identifier.
- Include all SDK-provided transaction history, incoming and outgoing, retaining confirmed and spent entries when supplied by Arkade, ordered newest first. Copy copies the entire displayed transaction list. Do not restrict the list to current UTXOs or pending deposits.
- Load existing activity on entry and update while the view is open through Arkade SDK notifications, with loading, empty, and unavailable states.
- Expose normalized activity through the integration public API; keep SDK types and provider calls inside the Arkade adapter.
- Require Arkade SDK support. Do not implement a separate mempool client, custom server, simulated results, or inferred payment success. The SDK's own built-in explorer provider is permitted.
- Add the A5 Admin demonstration and synchronize user-story documentation during implementation. Keep A4 balances distinct from pending activity.

## Capabilities

### New Capabilities
- `account-activity`: SDK-backed full available transaction history, public state, lifecycle, and minimal production display.

### Modified Capabilities
- `account-entry`: Add the Account Activity action to the active Account menu and remove the A5 deferral for this slice.
- `story-driven-demo`: Add the A5 Inspect Activity demonstration and truthful story documentation.

## Impact

Planned implementation affects integration arkade/core/ui and public exports, the demo Admin catalog, and current documentation. No dependency or backend addition is planned. Existing unrelated working-tree changes and the achievement proposal remain separate.

Installed SDK 0.4.67 source includes unconfirmed boarding transactions in wallet history and supplies confirmation status through incoming notifications. A live read using its built-in EsploraProvider returned an unconfirmed output for the supplied public Signet address. Wallet-level initial-load, notification, and confirmation behavior remains a mandatory implementation verification gate; do not bypass a failed gate with a direct explorer integration.
