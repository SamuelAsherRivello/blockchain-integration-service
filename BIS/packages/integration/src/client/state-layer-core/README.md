# State layer core

This layer owns BIS context lifecycle, immutable public state snapshots, subscriptions, public events, browser-local state records, and cross-layer state reduction. Keep React rendering in `ui-layer-react` and direct Arkade SDK calls in `wallet-layer-arkade`.

Existing context, equipment, continuation, collection and contract controllers remain implementation building blocks and supported non-game consumer exports. Games use facade-owned named `IBis` commands and copied `BisSnapshot`/workflow projections instead of owning those controllers. Financial confirmation and `BisGameEffectReceipt` are separate outcomes: a stale or rejected gameplay effect must not retry payment or minting. Contract recovery owns durable financial progress; the facade forwards its changes through `IBisGame.onBisEvent` without game UI polling.
