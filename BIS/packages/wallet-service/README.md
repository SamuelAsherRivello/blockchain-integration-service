# Shared game wallet service

The BIS Admin imports the game wallet once. This service keeps its signing material and contract recovery on private disk; both the local game and deployed game use its public API. Players keep their own keys in their browser. The Admin tab can close after import.

The server runs the existing Signet contract adapter, preserving its zero-fee checks, exact receipts, asset-preserving change, deadlines and uncertain-operation reservations. It is a BIS application service, not an Arkade operator or delegate.

## Local use

Use Node 26 or later, then run from the repository root:

```powershell
npm run wallet:service
```

Keep the process running. The default endpoint is `http://127.0.0.1:8787`. BIS Admin at `http://127.0.0.1:5174/` and Stealth & Steel at `http://127.0.0.1:5173/` use that endpoint in development. Start the two Vite applications with their normal development commands when needed.

Import a funded Signet game wallet in Admin → F. Game Wallet. An existing selected Admin browser wallet is migrated automatically once when the service is empty and that browser has no unresolved wallet operations. Migration never funds an offer. It preserves stored identities and deselects the old browser signer after successful import. An explicit service Logout remains deselected across reloads. Old unresolved browser operations must retain their original recovery path; they are not copied or treated as cancelled.

For first-time setup, click Start, then open the gear → Account and connect the player. The Start overlay covers Settings, so Account setup happens inside the game. Reload after connecting, allow wallet readiness to finish, then click Start for a fresh Level01 run. Start creates the 1,000-sat offer automatically. Walk two cells upward from the player spawn into the chest within 90 seconds. Claim or Reject closes the game dialog after pending feedback; confirmed results arrive as passive toasts. A player with zero sats can claim. Pausing and opening the chest do not stop the timer. An account connected after Start becomes eligible on the next fresh run.

## Hosted use

GitHub Pages only serves the static BIS/game builds. Deploy this Node service separately, with a private persistent data directory and an HTTPS reverse proxy. Use the same hosted service for both builds by setting their public `VITE_BIS_WALLET_SERVICE_URL` to its HTTPS base URL before building or starting Vite. This value is public configuration and contains no credentials.

Service configuration:

| Variable | Meaning |
| --- | --- |
| `BIS_WALLET_PORT` | Loopback listening port; default 8787. |
| `BIS_WALLET_DATA_DIR` | Private persistent directory; default `.bis-wallet-service/signet` under the service user's home directory. |
| `BIS_WALLET_ORIGINS` | Comma-separated exact allowed browser origins, including the deployed game and local preview origins. |

Run one writer for each data directory. The service rejects a second writer. Its SQLite state is encrypted; the private volume includes its encryption key and must remain outside all static directories, source control and build artifacts. Back up and restore the complete private volume together. Losing the encryption key is not repaired by generating another wallet.

Expose only `/health` and `/v1/*` through HTTPS. Preserve the original HTTP Host header and reject `/admin/*` at the public proxy. Admin requests additionally require a loopback Host, loopback browser Origin and a loopback connection at the service. Manage the hosted service from a local Admin browser through a private SSH tunnel to its port, using that tunnel as the Admin's configured service URL. The game uses the public HTTPS URL; both reach the same running service and disk store. Do not publish the raw loopback port.

No production endpoint is assumed or created by the package. The deployment owner must select the hosting target and configure the HTTPS URL/origin allowlist. The local and hosted API and signing workflow are identical.

## API and recovery boundaries

- `GET /health` and `GET /v1/wallet` return public health/readiness information only.
- Protected `POST /admin/action` imports/selects the wallet and invokes the existing Admin wallet operations. It never returns the game phrase.
- Player `POST /v1/start`, `/claim`, `/reject`, `/end`, `/query`, `/sync` and `/signature` require a fresh signed request bound to the method, path and exact body. Replays and another player's operations are rejected.
- The initial hosted preset accepts a 1,000-sat, 90-second `treasureLTO`. Host semantics remain outside the generic BIS contract model. The service enforces one unresolved treasure slot per game/player, independently of browser origin.
- The browser reconstructs and validates the exact claim transaction graph before signing. It signs only with the player's key. The service rejects changed transaction outputs and persists checkpoint recovery before finalization.
- Service timers reconcile and refund eligible expired offers while the service is running. A stopped service cannot execute timers; restart resumes durable recovery. Submitted or unknown operations are never replaced merely because a request timed out.
- Player browser cleanup cannot erase the server's game-owned recovery. Existing contract records remain inspectable through the normal BIS Contracts UI.

X8. Add security to game wallet tracks the broader authorization, abuse limits, key-management and operational security rethink. The current implementation is a Signet learning/demo service, not a completed production-security review.

## Verification

```powershell
node --test --test-isolation=none BIS/packages/wallet-service/tests/*.test.mjs
node --test --test-isolation=none BIS/packages/integration/tests/lto-simulated-operator.test.mjs
```

These tests use isolated identities and an isolated operator, including real SDK signatures and receipt checks. They do not submit live transactions. User-wallet and deployment evidence must be reported separately.
